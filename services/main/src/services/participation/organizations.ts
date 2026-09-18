import { establishOrganizationEnrollmentControl } from "./organization-control";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { parseContentLanguageTag } from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import { entityIdentity } from "@rezics/schema/postgres/catalog/identity";
import { participationGrant, participationGrantEvent } from "@rezics/schema/postgres/access/participation";
import { createParticipantIdentity } from "./identity";
import { reserveParticipationGrantCapacity } from "./lifecycle";
import { ParticipationDenied, requireParticipation, type ParticipationAuthority } from "./policy";
import { publicEntityName } from "./presentation";

export const ManagedOrganizationCapabilityValues = [
	"entity.publish",
	"entity.security",
] as const;

export const CreateManagedOrganizationSchema = z.strictObject({
	name: z.string().trim().min(1).max(120),
	language: z.string().min(1).max(255),
});

/** Creates a new managed identity. Existing catalog subjects require evidence-reviewed recovery. */
export async function createManagedOrganization(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	input: z.input<typeof CreateManagedOrganizationSchema>,
) {
	const value = CreateManagedOrganizationSchema.parse(input);
	if (authority.principal.kind !== "auth" || authority.grant)
		throw new ParticipationDenied(
			"Managed identity creation requires the human operator's own session",
		);
	await requireParticipation(tx, authority, "entity.security", {
		owner: "entity",
		id: authority.actingEntityId,
	});
	const authUserId = authority.principal.authUserId;
	await reserveParticipationGrantCapacity(tx, { kind: "auth", id: authUserId }, 2);
	const identity = await createParticipantIdentity(tx, {
		shape: "organization",
		operatorAuthUserId: authUserId,
		names: [{ language: parseContentLanguageTag(value.language).tag, value: value.name }],
	});
	const grants = await tx
		.insert(participationGrant)
		.values(
			(["entity.security", "entity.publish"] as const).map((capability) => ({
				authUserId,
				actingEntityId: identity.id,
				entityId: identity.id,
				capability,
				createdByAuthUserId: authUserId,
			})),
		)
		.returning({
			id: participationGrant.id,
			revision: participationGrant.revision,
			capability: participationGrant.capability,
		});
	await tx.insert(participationGrantEvent).values(
		grants.map((grant) => ({
			grantId: grant.id,
			revision: grant.revision,
			operation: "grant" as const,
			operatorAuthUserId: authUserId,
		})),
	);
	const native = await establishOrganizationEnrollmentControl(tx,{ entityId: identity.id,recipientAuthUserId: authUserId,operatorAuthUserId: authUserId },
  sql`public.access_subject_is_eligible((select id from public.access_subject where auth_user_id=${authUserId}::uuid),'write')`);
 return { entityId: identity.id, grants, native };
}

/** Indexed, bounded list of organizations with the requested explicit human capability. */
export async function listManagedOrganizations(
	tx: DatabaseTransaction,
	authUserId: string,
	afterId?: string,
	capability: (typeof ManagedOrganizationCapabilityValues)[number] = "entity.security",
) {
	const rows = await tx
		.select({
			entityId: entityIdentity.id,
			name: publicEntityName(entityIdentity.id),
			grantId: participationGrant.id,
			revision: participationGrant.revision,
		})
		.from(participationGrant)
		.innerJoin(entityIdentity, eq(entityIdentity.id, participationGrant.actingEntityId))
		.where(
			and(
				eq(participationGrant.authUserId, authUserId),
				eq(participationGrant.capability, capability),
				isNull(participationGrant.revokedAt),
				or(isNull(participationGrant.expiresAt), gt(participationGrant.expiresAt, new Date())),
				eq(entityIdentity.shape, "organization"),
				isNull(entityIdentity.deletedAt),
				afterId ? gt(participationGrant.id, z.uuid().parse(afterId)) : undefined,
			),
		)
		.orderBy(participationGrant.id)
		.limit(101);
	const items = rows.slice(0, 100);
	return { items, nextCursor: rows.length > 100 ? (items.at(-1)?.grantId ?? null) : null };
}
