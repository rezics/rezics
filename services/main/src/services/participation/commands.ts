import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { users } from "../database/schema/auth";
import {
	authEntity,
	participationGrant,
	participationGrantEvent,
	servicePrincipal,
	ParticipationCapabilityValues,
} from "../database/schema/participation";
import { CatalogIdentityTables } from "../database/schema/catalog-identity";
import { CatalogReferenceSchema } from "../catalog/contracts";
import {
	ParticipationAuthoritySchema,
	ParticipationDenied,
	requireParticipation,
	type ParticipationAuthority,
} from "./policy";
import {
	lockEntityControl,
	reserveParticipationGrantCapacity,
	MaximumControlledServicePrincipals,
	MaximumEntitySecurityControllers,
	suspendUncontrolledEntity,
} from "./lifecycle";
import { createParticipantIdentity } from "./identity";
import { catalogSourceAdoptionProposal } from "../database/schema/catalog-source";
import { lockCatalogSourceBinding } from "../catalog/source-bindings";
import { publicEntityName } from "./presentation";

export const IssueGrantInputSchema = z
	.strictObject({
		recipient: z.discriminatedUnion("kind", [
			z.strictObject({ kind: z.literal("auth"), authUserId: z.uuid() }),
			z.strictObject({ kind: z.literal("service"), servicePrincipalId: z.uuid() }),
		]),
		actingEntityId: z.uuid(),
		capability: z.enum(ParticipationCapabilityValues),
		target: CatalogReferenceSchema,
		expiresAt: z.coerce.date().optional(),
		proposal: z.strictObject({ sourceRecordId: z.uuid(), proposalId: z.uuid() }).optional(),
	})
	.refine((value) => (value.capability === "proposal.adopt") === (value.proposal !== undefined), {
		message: "Proposal adoption requires an exact approved proposal scope",
	});

/** @alpha Explicit invitation grant. Metadata editing does not authorize acting as the subject. */
export async function issueParticipationGrant(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	input: z.input<typeof IssueGrantInputSchema>,
) {
	const value = IssueGrantInputSchema.parse(input);
	if (authority.principal.kind !== "auth")
		throw new ParticipationDenied("Service principals cannot delegate authority");
	if (value.proposal) {
		const [proposal] = await tx
			.select()
			.from(catalogSourceAdoptionProposal)
			.where(
				and(
					eq(catalogSourceAdoptionProposal.sourceRecordId, value.proposal.sourceRecordId),
					eq(catalogSourceAdoptionProposal.id, value.proposal.proposalId),
				),
			)
			.limit(1);
		if (!proposal || proposal.state !== "pending")
			throw new ParticipationDenied("Only a pending exact proposal may be approved");
		const binding = await lockCatalogSourceBinding(tx, {
			sourceRecordId: proposal.sourceRecordId,
			mappingKey: proposal.mappingKey,
		});
		if (
			binding.reference.owner !== value.target.owner ||
			binding.reference.id !== value.target.id ||
			binding.claim.state !== "active" ||
			binding.claim.bindingRevision !== proposal.expectedBindingRevision ||
			binding.claim.policyRevision !== proposal.expectedPolicyRevision ||
			binding.source.headSnapshotId !== proposal.snapshotId
		)
			throw new ParticipationDenied("Proposal source binding changed before approval");
	}
	await lockEntityControl(tx, authority, authority.actingEntityId);
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	if (value.expiresAt && value.expiresAt <= new Date())
		throw new ParticipationDenied("Grant expiry must be in the future");
	if (value.capability === "entity.security" && value.recipient.kind !== "auth")
		throw new ParticipationDenied("Security control requires a human account");
	if (value.capability === "entity.security") {
		const controllers = await tx
			.select({ id: participationGrant.id })
			.from(participationGrant)
			.where(
				and(
					eq(participationGrant.actingEntityId, authority.actingEntityId),
					eq(participationGrant.capability, "entity.security"),
					isNull(participationGrant.revokedAt),
				),
			)
			.limit(MaximumEntitySecurityControllers);
		if (controllers.length >= MaximumEntitySecurityControllers)
			throw new ParticipationDenied("Entity security controller limit reached");
	}
	const recipientId =
		value.recipient.kind === "auth"
			? value.recipient.authUserId
			: value.recipient.servicePrincipalId;
	await reserveParticipationGrantCapacity(tx, { kind: value.recipient.kind, id: recipientId });
	if (value.recipient.kind === "auth") {
		const [recipient] = await tx
			.select({ id: users.id })
			.from(users)
			.innerJoin(authEntity, eq(authEntity.authUserId, users.id))
			.where(
				and(
					eq(users.id, value.recipient.authUserId),
					isNull(users.erasedAt),
					eq(authEntity.state, "active"),
				),
			)
			.limit(1)
			.for("share");
		if (!recipient) throw new ParticipationDenied("Recipient has no active human account");
	} else {
		const [recipient] = await tx
			.select()
			.from(servicePrincipal)
			.where(eq(servicePrincipal.id, value.recipient.servicePrincipalId))
			.limit(1)
			.for("share");
		if (!recipient || recipient.revokedAt || recipient.entityId !== value.actingEntityId)
			throw new ParticipationDenied("Service grant must retain the service actor's identity");
	}
	if (value.capability.startsWith("entity.")) {
		if (
			value.target.owner !== "entity" ||
			value.target.id !== authority.actingEntityId ||
			value.actingEntityId !== authority.actingEntityId
		)
			throw new ParticipationDenied("Entity delegation requires its security controller");

	} else {
		const table = CatalogIdentityTables[value.target.owner];
		const [target] = await tx
			.select()
			.from(table)
			.where(eq(table.id, value.target.id))
			.limit(1)
			.for("share");
		if (
			!target ||
			target.deletedAt ||
			target.createdByAuthUserId !== authority.principal.authUserId
		)
			throw new ParticipationDenied("Only the target controller can issue catalog authority");
		// Catalog contributors retain their own authorship; a catalog grant cannot select another Entity.
		const [recipient] =
			value.recipient.kind === "auth"
				? await tx
						.select({ entityId: authEntity.entityId })
						.from(authEntity)
						.where(eq(authEntity.authUserId, value.recipient.authUserId))
						.limit(1)
						.for("share")
				: await tx
						.select({ entityId: servicePrincipal.entityId })
						.from(servicePrincipal)
						.where(eq(servicePrincipal.id, value.recipient.servicePrincipalId))
						.limit(1)
						.for("share");
		if (!recipient || recipient.entityId !== value.actingEntityId)
			throw new ParticipationDenied("Catalog grant must preserve the recipient's own identity");
	}
	const [grant] = await tx
		.insert(participationGrant)
		.values({
			authUserId: value.recipient.kind === "auth" ? value.recipient.authUserId : null,
			servicePrincipalId:
				value.recipient.kind === "service" ? value.recipient.servicePrincipalId : null,
			actingEntityId: value.actingEntityId,
			capability: value.capability,
			proposalSourceRecordId: value.proposal?.sourceRecordId,
			proposalId: value.proposal?.proposalId,
			publishingId: value.target.owner === "publishing" ? value.target.id : null,
			musicId: value.target.owner === "music" ? value.target.id : null,
			programId: value.target.owner === "program" ? value.target.id : null,
			softwareId: value.target.owner === "software" ? value.target.id : null,
			entityId: value.target.owner === "entity" ? value.target.id : null,
			groupingId: value.target.owner === "grouping" ? value.target.id : null,
			referenceId: value.target.owner === "reference" ? value.target.id : null,
			distributionId: value.target.owner === "distribution" ? value.target.id : null,
			expiresAt: value.expiresAt,
			createdByAuthUserId: authority.principal.authUserId,
		})
		.returning();
	if (!grant) throw new Error("Grant insertion failed");
	await tx.insert(participationGrantEvent).values({
		grantId: grant.id,
		revision: 1,
		operation: "grant",
		operatorAuthUserId: authority.principal.authUserId,
	});
	return { id: grant.id, revision: grant.revision };
}

/** Revocation is a versioned write against the same row locked by every protected effect. */
export async function revokeParticipationGrant(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	id: string,
	expectedRevision: number,
) {
	z.uuid().parse(id);
	z.number().int().positive().parse(expectedRevision);
	if (authority.principal.kind !== "auth")
		throw new ParticipationDenied("Service principals cannot revoke grants");
	const [candidate] = await tx
		.select()
		.from(participationGrant)
		.where(eq(participationGrant.id, id))
		.limit(1);
	if (!candidate) throw new ParticipationDenied("Grant is unavailable");
	await lockEntityControl(tx, authority, candidate.actingEntityId);
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	const [grant] = await tx
		.select()
		.from(participationGrant)
		.where(eq(participationGrant.id, id))
		.limit(1)
		.for("update");
	if (
		!grant ||
		(grant.capability.startsWith("entity.")
			? grant.actingEntityId !== authority.actingEntityId
			: grant.createdByAuthUserId !== authority.principal.authUserId) ||
		grant.revision !== expectedRevision ||
		grant.revokedAt !== null
	)
		throw new ParticipationDenied("Grant is stale or not controlled by this account");
	const revision = grant.revision + 1;
	await tx
		.update(participationGrant)
		.set({ revokedAt: new Date(), revision })
		.where(eq(participationGrant.id, id));
	await tx.insert(participationGrantEvent).values({
		grantId: id,
		revision,
		operation: "revoke",
		operatorAuthUserId: authority.principal.authUserId,
	});
	if (grant.capability === "entity.security")
		await suspendUncontrolledEntity(tx, grant.actingEntityId);
	return { id, revision };
}

/** Lists only the actual account's invitations, without traversing organization membership. */
/** Security managers inspect a bounded Entity grant page, including grants issued to other principals. */
export async function listManagedEntityGrants(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	entityId: string,
	afterId?: string,
) {
	z.uuid().parse(entityId);
	if (afterId) z.uuid().parse(afterId);
	await requireParticipation(tx, authority, "entity.security", { owner: "entity", id: entityId });
	return tx
		.select({
			grant: participationGrant,
			accountEntityId: authEntity.entityId,
			recipientName: publicEntityName(
				sql`coalesce(${authEntity.entityId}, ${servicePrincipal.entityId})`,
			),
		})
		.from(participationGrant)
		.leftJoin(authEntity, eq(authEntity.authUserId, participationGrant.authUserId))
		.leftJoin(servicePrincipal, eq(servicePrincipal.id, participationGrant.servicePrincipalId))
		.where(
			and(
				eq(participationGrant.actingEntityId, entityId),
				afterId ? gt(participationGrant.id, afterId) : undefined,
			),
		)
		.orderBy(participationGrant.id)
		.limit(101);
}

export async function listParticipationGrants(
	tx: DatabaseTransaction,
	authUserId: string,
	afterId?: string,
) {
	z.uuid().parse(authUserId);
	if (afterId) z.uuid().parse(afterId);
	return tx
		.select()
		.from(participationGrant)
		.where(
			and(
				eq(participationGrant.authUserId, authUserId),
				afterId ? gt(participationGrant.id, afterId) : undefined,
			),
		)
		.orderBy(participationGrant.id)
		.limit(101);
}

/** Only active human security grants expose a service's management record; credentials are excluded. */
export async function listControlledServicePrincipals(
	tx: DatabaseTransaction,
	authUserId: string,
	afterGrantId?: string,
) {
	return tx
		.select({
			id: servicePrincipal.id,
			entityId: servicePrincipal.entityId,
			name: servicePrincipal.name,
			revision: servicePrincipal.revision,
			createdAt: servicePrincipal.createdAt,
			revokedAt: servicePrincipal.revokedAt,
			grantId: participationGrant.id,
			grantRevision: participationGrant.revision,
		})
		.from(participationGrant)
		.innerJoin(servicePrincipal, eq(servicePrincipal.entityId, participationGrant.actingEntityId))
		.where(
			and(
				eq(participationGrant.authUserId, z.uuid().parse(authUserId)),
				eq(participationGrant.capability, "entity.security"),
				isNull(participationGrant.revokedAt),
				or(isNull(participationGrant.expiresAt), gt(participationGrant.expiresAt, new Date())),
				afterGrantId ? gt(participationGrant.id, z.uuid().parse(afterGrantId)) : undefined,
			),
		)
		.orderBy(participationGrant.id)
		.limit(101);
}

/** A separate non-interactive Auth account preserves truthful private operator FKs. */
export async function createServicePrincipal(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	name: string,
) {
	const displayName = z.string().trim().min(1).max(120).parse(name);
	if (authority.principal.kind !== "auth")
		throw new ParticipationDenied("A human controller is required");
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`service-principal:${authority.principal.authUserId}`}, 0))`,
	);
	const controlled = await tx
		.select({ id: servicePrincipal.id })
		.from(servicePrincipal)
		.where(
			and(
				eq(servicePrincipal.createdByAuthUserId, authority.principal.authUserId),
				isNull(servicePrincipal.revokedAt),
			),
		)
		.limit(MaximumControlledServicePrincipals);
	if (controlled.length >= MaximumControlledServicePrincipals)
		throw new ParticipationDenied("Controlled service principal limit reached");
	await reserveParticipationGrantCapacity(tx, { kind: "auth", id: authority.principal.authUserId });
	const secret = `rz_service_${randomBytes(32).toString("base64url")}`;
	const [account] = await tx
		.insert(users)
		.values({
			name: displayName,
			email: `${randomBytes(24).toString("hex")}@service.invalid`,
			principalKind: "service",
			emailVerified: false,
		})
		.returning({ id: users.id });
	if (!account) throw new Error("Service account insertion failed");
	const entity = await createParticipantIdentity(tx, {
		shape: "service_actor",
		operatorAuthUserId: authority.principal.authUserId,
		names: [{ language: null, value: displayName }],
	});
	const [principal] = await tx
		.insert(servicePrincipal)
		.values({
			authUserId: account.id,
			entityId: entity.id,
			name: displayName,
			credentialDigest: digest(secret),
			createdByAuthUserId: authority.principal.authUserId,
		})
		.returning({ id: servicePrincipal.id, revision: servicePrincipal.revision });
	if (!principal) throw new Error("Service principal insertion failed");
	const [controlGrant] = await tx
		.insert(participationGrant)
		.values({
			authUserId: authority.principal.authUserId,
			actingEntityId: entity.id,
			entityId: entity.id,
			capability: "entity.security",
			createdByAuthUserId: authority.principal.authUserId,
		})
		.returning({ id: participationGrant.id });
	if (!controlGrant) throw new Error("Service controller insertion failed");
	await tx.insert(participationGrantEvent).values({
		grantId: controlGrant.id,
		revision: 1,
		operation: "grant",
		operatorAuthUserId: authority.principal.authUserId,
	});
	return {
		...principal,
		authUserId: account.id,
		entityId: entity.id,
		secret,
		controlGrant: { id: controlGrant.id, revision: 1 },
	};
}

/** Authenticates a machine credential; every write must still revalidate its scoped grant. */
export async function resolveServicePrincipal(
	tx: DatabaseTransaction,
	secret: string,
	grant: { id: string; revision: number },
): Promise<ParticipationAuthority> {
	z.string()
		.regex(/^rz_service_[A-Za-z0-9_-]{43}$/)
		.parse(secret);
	const [principal] = await tx
		.select()
		.from(servicePrincipal)
		.where(eq(servicePrincipal.credentialDigest, digest(secret)))
		.limit(1)
		.for("share");
	if (!principal || principal.revokedAt !== null)
		throw new ParticipationDenied("Service credential is invalid");
	return ParticipationAuthoritySchema.parse({
		principal: {
			kind: "service",
			servicePrincipalId: principal.id,
			authUserId: principal.authUserId,
		},
		actingEntityId: principal.entityId,
		authorizationRevision: principal.revision,
		grant,
	});
}

export async function revokeServicePrincipal(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	id: string,
	expectedRevision: number,
) {
	z.uuid().parse(id);
	z.number().int().positive().parse(expectedRevision);
	if (authority.principal.kind !== "auth")
		throw new ParticipationDenied("A human controller is required");
	const [candidate] = await tx
		.select({ entityId: servicePrincipal.entityId })
		.from(servicePrincipal)
		.where(eq(servicePrincipal.id, id))
		.limit(1);
	if (!candidate || candidate.entityId !== authority.actingEntityId)
		throw new ParticipationDenied("Select the service actor's current security grant");
	await lockEntityControl(tx, authority, candidate.entityId);
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	const [principal] = await tx
		.select()
		.from(servicePrincipal)
		.where(eq(servicePrincipal.id, id))
		.limit(1)
		.for("update");
	if (
		!principal ||
		principal.entityId !== authority.actingEntityId ||
		principal.revokedAt !== null ||
		principal.revision !== expectedRevision
	)
		throw new ParticipationDenied("Service principal is stale or not controlled by this account");
	await tx
		.update(servicePrincipal)
		.set({ revokedAt: new Date(), revision: expectedRevision + 1 })
		.where(eq(servicePrincipal.id, id));
	return { id, revision: expectedRevision + 1 };
}

function digest(secret: string) {
	return createHash("sha256").update(secret).digest("hex");
}
