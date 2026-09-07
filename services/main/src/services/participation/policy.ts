import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
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
});
export type ApprovedSourceProposal = z.infer<typeof ApprovedSourceProposalSchema>;

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
	const authority = currentParticipationAuthority();
	if (!authority || actorAuthUserId === null) return targets.map(() => false);
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
		return targets.map(
			({ reference }) =>
				reference.owner === sourceApplication.scope.reference.owner &&
				reference.id === sourceApplication.scope.reference.id,
		);
	}
	if (!authority.grant) {
		if (authority.principal.kind !== "auth") return targets.map(() => false);
		await requireParticipation(tx, authority, "entity.security", {
			owner: "entity",
			id: authority.actingEntityId,
		});
		if (write) await new AccountAuthorization(actorAuthUserId).ensureCanContribute(tx);
		return targets.map(
			({ reference, createdByAuthUserId }) =>
				createdByAuthUserId === actorAuthUserId ||
				(reference.owner === "entity" && reference.id === authority.actingEntityId),
		);
	}
	const [grant] = await tx
		.select()
		.from(participationGrant)
		.where(eq(participationGrant.id, authority.grant.id))
		.limit(1);
	if (!grant || grant.capability === "proposal.adopt") return targets.map(() => false);
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
	await requireParticipation(tx, authority, write ? "catalog.edit" : "catalog.read", target);
	return targets.map(
		({ reference }) => reference.owner === target.owner && reference.id === target.id,
	);
}
