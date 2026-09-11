import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { HTTPError } from "elysia";
import type { DatabaseTransaction } from "../database";
import {
	authEntity,
	participationGrant,
	servicePrincipal,
	ParticipationCapabilityValues,
	entityParticipation,
} from "../database/schema/participation";
import { CatalogReferenceSchema, type CatalogReference } from "../catalog/contracts";
import { users } from "../database/schema/auth";
import { ensureAccountAuthenticationAllowed } from "../auth/account-state";
import { AccountAuthorization } from "../authorization/account/authorization";
import { catalogSourceProposalDependency } from "../database/schema/catalog-source-dependency";
import {
	catalogSourceMappingClaim,
	catalogSourceAdoptionProposal,
	catalogSourceBindingRevision,
} from "../database/schema/catalog-source";
import { catalogSourceApplication } from "../database/schema/catalog-source-application";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { mergedCatalogReadPredicate, catalogMergeSourcePredicate } from "../catalog/merge-read";
import { catalogReadRatingPredicate } from "../catalog/read-policy";

/** @alpha Request and queued command identity, including the revision approved at admission. */
export const ParticipationAuthoritySchema = z.strictObject({
	principal: z.discriminatedUnion("kind", [
		z.strictObject({ kind: z.literal("auth"), authUserId: z.uuid() }),
		z.strictObject({
			kind: z.literal("service"),
			servicePrincipalId: z.uuid(),
			authUserId: z.uuid(),
		}),
	]),
	actingEntityId: z.uuid(),
	authorizationRevision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	grant: z
		.strictObject({
			id: z.uuid(),
			revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		})
		.optional(),
});
export type ParticipationAuthority = z.infer<typeof ParticipationAuthoritySchema>;
export type ParticipationCapability = (typeof ParticipationCapabilityValues)[number];
export class ParticipationDenied extends HTTPError.id("ParticipationDenied", 403) {
	override readonly message: string;
	constructor(message = "Current participation authority is required") {
		super();
		this.message = message;
	}
}
const authorities = new AsyncLocalStorage<ParticipationAuthority>();
const approvedSourceApplications = new AsyncLocalStorage<{
	tx: DatabaseTransaction;
	scope: ApprovedSourceProposal;
}>();
const ApprovedSourceProposalSchema = z.strictObject({
	sourceRecordId: z.uuid(),
	proposalId: z.uuid(),
	reference: CatalogReferenceSchema,
	action: z.enum(["apply", "withdraw", "reject", "supersede"]),
});
export type ApprovedSourceProposal = z.infer<typeof ApprovedSourceProposalSchema>;

/** Carries exact proposal scope only into a savepoint created from its current transaction. */
export function runParticipationSavepoint<T>(
	tx: DatabaseTransaction,
	work: (nested: DatabaseTransaction) => Promise<T>,
): Promise<T> {
	const approved = approvedSourceApplications.getStore();
	return tx.transaction((nested) =>
		approved?.tx === tx
			? approvedSourceApplications.run({ ...approved, tx: nested }, () => work(nested))
			: work(nested),
	);
}

/**
 * The source decision owner first locks and checks the exact proposal/binding/native revision.
 * This callback scope then consumes the human's exact proposal grant and permits only that native target.
 * @internal
 */
export async function runWithApprovedSourceProposal<T>(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	input: ApprovedSourceProposal,
	callback: () => Promise<T>,
): Promise<T> {
	const scope = ApprovedSourceProposalSchema.parse(input);
	await requireParticipation(tx, authority, "proposal.adopt", scope.reference, scope);
	return approvedSourceApplications.run({ tx, scope }, () =>
		runWithParticipationAuthority(authority, callback),
	);
}

/** @alpha Workers must restore the admitted authority explicitly; current state is checked at mutation. */
export function runWithParticipationAuthority<T>(
	authority: ParticipationAuthority,
	work: () => T,
): T {
	return authorities.run(ParticipationAuthoritySchema.parse(authority), work);
}
export function currentParticipationAuthority() {
	return authorities.getStore();
}

/**
 * Admit independent catalog identities using current human self authority.
 * @remarks Existing resource/proposal grants do not authorize unrelated identity
 * intake. Participant bootstrap uses its own account/controller checks before
 * writing storage; a UUID supplied as creator is never authority by itself.
 * @internal
 */
export async function requireCatalogIdentityAdmission(
	tx: DatabaseTransaction,
	actorAuthUserId: string,
): Promise<void> {
	const authority = currentParticipationAuthority();
	if (
		!authority ||
		authority.principal.kind !== "auth" ||
		authority.grant ||
		authority.principal.authUserId !== actorAuthUserId ||
		approvedSourceApplications.getStore()?.tx === tx
	)
		throw new ParticipationDenied();
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	await new AccountAuthorization(actorAuthUserId).ensureCanContribute(tx);
}

export function validateGrant(
	grant: typeof participationGrant.$inferSelect,
	authority: ParticipationAuthority,
	capability: ParticipationCapability,
	target: CatalogReference,
	now: Date,
	proposal?: Pick<ApprovedSourceProposal, "sourceRecordId" | "proposalId">,
) {
	const targets = {
		publishing: grant.publishingId,
		music: grant.musicId,
		program: grant.programId,
		software: grant.softwareId,
		entity: grant.entityId,
		grouping: grant.groupingId,
		reference: grant.referenceId,
		distribution: grant.distributionId,
	};
	const principalMatches =
		authority.principal.kind === "auth"
			? grant.authUserId === authority.principal.authUserId
			: grant.servicePrincipalId === authority.principal.servicePrincipalId;
	if (
		!principalMatches ||
		grant.actingEntityId !== authority.actingEntityId ||
		!(
			grant.capability === capability ||
			(capability === "catalog.read" && grant.capability === "catalog.edit")
		) ||
		targets[target.owner] !== target.id ||
		grant.id !== authority.grant?.id ||
		grant.revision !== authority.grant.revision ||
		grant.revokedAt !== null ||
		(grant.expiresAt !== null && grant.expiresAt <= now) ||
		(capability === "proposal.adopt" &&
			(grant.proposalId !== proposal?.proposalId ||
				grant.proposalSourceRecordId !== proposal?.sourceRecordId))
	)
		throw new ParticipationDenied("Current scoped authority is required");
}

/** Locks authority until the protected transaction ends, serializing revocation with the effect. */
export async function requireParticipation(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	capability: ParticipationCapability,
	target: CatalogReference,
	proposal?: Pick<ApprovedSourceProposal, "sourceRecordId" | "proposalId">,
) {
	ParticipationAuthoritySchema.parse(authority);
	const [account] = await tx
		.select({ erasedAt: users.erasedAt })
		.from(users)
		.where(eq(users.id, authority.principal.authUserId))
		.limit(1)
		.for("share");
	if (!account || account.erasedAt) throw new ParticipationDenied("Account is unavailable");
	await ensureAccountAuthenticationAllowed(authority.principal.authUserId, tx);
	if (capability === "catalog.edit" || capability === "proposal.adopt")
		await new AccountAuthorization(authority.principal.authUserId).ensureCanContribute(tx);
	if (capability === "entity.publish")
		await new AccountAuthorization(authority.principal.authUserId).ensureCanWrite(tx);
	{
		const [participation] = await tx
			.select()
			.from(entityParticipation)
			.where(eq(entityParticipation.entityId, authority.actingEntityId))
			.limit(1)
			.for("share");
		if (!participation || participation.state !== "active")
			throw new ParticipationDenied("Entity control requires recovery");
	}
	if (authority.principal.kind === "auth") {
		const [binding] = await tx
			.select()
			.from(authEntity)
			.where(eq(authEntity.authUserId, authority.principal.authUserId))
			.limit(1)
			.for("share");
		if (
			!binding ||
			binding.state !== "active" ||
			binding.revision !== authority.authorizationRevision
		)
			throw new ParticipationDenied("Account participation changed");
		if (
			!authority.grant &&
			binding.entityId === authority.actingEntityId &&
			target.owner === "entity" &&
			target.id === binding.entityId &&
			capability !== "proposal.adopt"
		)
			return;
	} else {
		const [principal] = await tx
			.select()
			.from(servicePrincipal)
			.where(eq(servicePrincipal.id, authority.principal.servicePrincipalId))
			.limit(1)
			.for("share");
		if (
			!principal ||
			principal.revokedAt !== null ||
			principal.revision !== authority.authorizationRevision ||
			principal.entityId !== authority.actingEntityId ||
			principal.authUserId !== authority.principal.authUserId
		)
			throw new ParticipationDenied("Service participation changed");
	}
	if (!authority.grant) throw new ParticipationDenied("A scoped grant is required");
	const [grant] = await tx
		.select()
		.from(participationGrant)
		.where(eq(participationGrant.id, authority.grant.id))
		.limit(1)
		.for("share");
	if (!grant) throw new ParticipationDenied("Scoped authority is missing");
	validateGrant(grant, authority, capability, target, new Date(), proposal);
}

/** Catalog creation records provenance; this policy separately evaluates current editing authority. */
export async function canAccessCatalog(
	tx: DatabaseTransaction,
	target: CatalogReference,
	actor: string | null,
	creatorAuthUserId: string | null,
	write: boolean,
) {
	const [allowed] = await catalogAccessDecisions(
		tx,
		[{ reference: target, createdByAuthUserId: creatorAuthUserId }],
		actor,
		write,
	);
	return allowed ?? false;
}

/** Evaluates a bounded native batch with one current authority check, never one authority query per row. @internal */
export async function catalogAccessDecisions(
	tx: DatabaseTransaction,
	targets: readonly { reference: CatalogReference; createdByAuthUserId: string | null }[],
	actorAuthUserId: string | null,
	write: boolean,
): Promise<boolean[]> {
	if (targets.length > 128)
		throw new RangeError("Catalog authority batches are limited to 128 targets");
	const scope = await resolveCatalogAuthorityScope(
		tx,
		actorAuthUserId,
		write,
		targets.map(({ reference }) => reference),
	);
	const allowed = new Set(scope.references.map(({ owner, id }) => `${owner}:${id}`));
	return targets.map(
		({ reference, createdByAuthUserId }) =>
			(scope.creatorAuthUserId !== null && createdByAuthUserId === scope.creatorAuthUserId) ||
			allowed.has(`${reference.owner}:${reference.id}`),
	);
}

/** Validated current read authority; a selected grant never inherits its account's creator rights. @internal */
export type CatalogAuthorityScope = Readonly<{
	creatorAuthUserId: string | null;
	references: readonly CatalogReference[];
}>;

export function readCatalogAuthorityScope(
	tx: DatabaseTransaction,
	actorAuthUserId: string | null,
): Promise<CatalogAuthorityScope> {
	return resolveCatalogAuthorityScope(tx, actorAuthUserId, false);
}

/** Uses the same authority as native reads inside indexed SQL queries and correlated target filters. @internal */
export function catalogIdentityReadPredicate(
	scope: CatalogAuthorityScope,
	owner: CatalogReference["owner"],
	table: {
		id: AnyPgColumn;
		createdByAuthUserId: AnyPgColumn;
		visibility: AnyPgColumn;
		status: AnyPgColumn;
		moderationStatus: AnyPgColumn;
		contentRating: AnyPgColumn;
		deletedAt: AnyPgColumn;
	} = CatalogIdentityTables[owner],
) {
	const ids = scope.references
		.filter((reference) => reference.owner === owner)
		.map((reference) => reference.id);
	const creator =
		scope.creatorAuthUserId === null
			? sql`false`
			: eq(table.createdByAuthUserId, scope.creatorAuthUserId);
	const granted = ids.length ? inArray(table.id, ids) : sql`false`;
	return sql`${table.deletedAt} is null and ${catalogReadRatingPredicate(table.contentRating)} and (
        ((${table.status} <> 'archived' or not ${catalogMergeSourcePredicate(owner, table.id)})
          and ((${creator}) is true or (${granted}) is true or (${table.visibility} in ('public','unlisted') and ${table.status}='published' and ${table.moderationStatus}='approved')))
        or ${mergedCatalogReadPredicate(owner, table, scope)})`;
}

async function resolveCatalogAuthorityScope(
	tx: DatabaseTransaction,
	actorAuthUserId: string | null,
	write: boolean,
	requestedReferences?: readonly CatalogReference[],
): Promise<CatalogAuthorityScope> {
	const authority = currentParticipationAuthority();
	if (!authority || actorAuthUserId === null) return { creatorAuthUserId: null, references: [] };
	if (authority.principal.authUserId !== actorAuthUserId)
		throw new ParticipationDenied("Catalog operator does not match current authority");
	const sourceApplication = approvedSourceApplications.getStore();
	if (sourceApplication?.tx === tx) {
		await requireParticipation(
			tx,
			authority,
			"proposal.adopt",
			sourceApplication.scope.reference,
			sourceApplication.scope,
		);
		const readableDependencies: CatalogReference[] = [];
		if (
			!write &&
			(!requestedReferences ||
				requestedReferences.some(
					(reference) =>
						reference.owner !== sourceApplication.scope.reference.owner ||
						reference.id !== sourceApplication.scope.reference.id,
				))
		) {
			const d = catalogSourceProposalDependency,
				c = catalogSourceMappingClaim,
				p = catalogSourceAdoptionProposal,
				b = catalogSourceBindingRevision,
				a = catalogSourceApplication;
			const boundTarget = {
				publishing: b.publishingId,
				music: b.musicId,
				program: b.programId,
				software: b.softwareId,
				entity: b.entityId,
				grouping: b.groupingId,
				reference: b.referenceId,
				distribution: b.distributionId,
			}[sourceApplication.scope.reference.owner];
			const prepared = await tx
				.select({ dependency: d })
				.from(d)
				.innerJoin(p, and(eq(p.sourceRecordId, d.sourceRecordId), eq(p.id, d.proposalId)))
				.innerJoin(
					b,
					and(
						eq(b.sourceRecordId, p.sourceRecordId),
						eq(b.mappingKey, p.mappingKey),
						eq(b.revision, p.expectedBindingRevision),
						eq(boundTarget, sourceApplication.scope.reference.id),
					),
				)
				.innerJoin(users, and(eq(users.id, d.preparedByAuthUserId), isNull(users.erasedAt)))
				.innerJoin(
					c,
					and(
						eq(c.sourceRecordId, d.dependencySourceRecordId),
						eq(c.mappingKey, d.dependencyMappingKey),
						eq(c.bindingRevision, d.dependencyBindingRevision),
						eq(c.state, "active"),
					),
				)
				.where(
					and(
						eq(d.sourceRecordId, sourceApplication.scope.sourceRecordId),
						eq(d.proposalId, sourceApplication.scope.proposalId),
						or(
							eq(d.snapshotId, p.snapshotId),
							sourceApplication.scope.action === "withdraw"
								? sql`exists (
							select 1 from ${a} where ${a.sourceRecordId}=${p.sourceRecordId} and ${a.proposalId}=${p.id} and ${a.action}='apply'
							and ${a.mappingKey}=${p.mappingKey} and ${a.previousSnapshotId}=${d.snapshotId}
							and ${a.previousObservedSnapshotId}=${d.snapshotId} and ${a.previousCorrespondenceRevision}=${b.correspondenceRevision}
						)`
								: sql`false`,
						),
						isNull(d.revokedAt),
						requestedReferences ? or(...requestedReferences.map((reference) => eq({
							publishing: d.publishingId, music: d.musicId, program: d.programId, software: d.softwareId,
							entity: d.entityId, grouping: d.groupingId, reference: d.referenceId, distribution: d.distributionId,
						}[reference.owner], reference.id))) : undefined,
					),
				)
				.limit(requestedReferences ? 256 : 128)
				.for("share", { of: [d, c, users] });
			for (const { dependency } of prepared)
				for (const [owner, id] of Object.entries({
					publishing: dependency.publishingId,
					music: dependency.musicId,
					program: dependency.programId,
					software: dependency.softwareId,
					entity: dependency.entityId,
					grouping: dependency.groupingId,
					reference: dependency.referenceId,
					distribution: dependency.distributionId,
				}))
					if (id !== null) readableDependencies.push(CatalogReferenceSchema.parse({ owner, id }));
		}
		return {
			creatorAuthUserId: null,
			references: [sourceApplication.scope.reference, ...readableDependencies],
		};
	}
	if (!authority.grant) {
		if (authority.principal.kind !== "auth") return { creatorAuthUserId: null, references: [] };
		await requireParticipation(tx, authority, "entity.security", {
			owner: "entity",
			id: authority.actingEntityId,
		});
		if (write) await new AccountAuthorization(actorAuthUserId).ensureCanContribute(tx);
		return {
			creatorAuthUserId: actorAuthUserId,
			references: [{ owner: "entity", id: authority.actingEntityId }],
		};
	}
	const [grant] = await tx
		.select()
		.from(participationGrant)
		.where(eq(participationGrant.id, authority.grant.id))
		.limit(1);
	if (!grant || grant.capability === "proposal.adopt")
		return { creatorAuthUserId: null, references: [] };
	const alternatives = Object.entries({
		publishing: grant.publishingId,
		music: grant.musicId,
		program: grant.programId,
		software: grant.softwareId,
		entity: grant.entityId,
		grouping: grant.groupingId,
		reference: grant.referenceId,
		distribution: grant.distributionId,
	}).filter(([, id]) => id !== null);
	if (alternatives.length !== 1 || !alternatives[0])
		throw new ParticipationDenied("Grant target is invalid");
	const target = CatalogReferenceSchema.parse({
		owner: alternatives[0][0],
		id: alternatives[0][1],
	});
	if (grant.capability !== "catalog.read" && grant.capability !== "catalog.edit") {
		await requireParticipation(tx, authority, grant.capability, target);
		return { creatorAuthUserId: null, references: [] };
	}
	await requireParticipation(tx, authority, write ? "catalog.edit" : "catalog.read", target);
	return { creatorAuthUserId: null, references: [target] };
}
