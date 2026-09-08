import { and, eq, gt, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { parseContentLanguageTag } from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import { entityIdentity } from "../database/schema/catalog-identity";
import { participationGrant, participationGrantEvent } from "../database/schema/participation";
import { createParticipantIdentity } from "./identity";
import { reserveParticipationGrantCapacity } from "./lifecycle";
import { ParticipationDenied, requireParticipation, type ParticipationAuthority } from "./policy";
import { publicEntityName } from "./presentation";

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
	await reserveParticipationGrantCapacity(tx, { kind: "auth", id: authUserId }, 3);
	const identity = await createParticipantIdentity(tx, {
		shape: "organization",
		operatorAuthUserId: authUserId,
		names: [{ language: parseContentLanguageTag(value.language).tag, value: value.name }],
	});
	const grants = await tx
		.insert(participationGrant)
		.values(
			(["entity.security", "entity.membership", "entity.publish"] as const).map((capability) => ({
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
	return { entityId: identity.id, grants };
}

/** Indexed, bounded list of organizations whose security this human can currently manage. */
export async function listManagedOrganizations(
	tx: DatabaseTransaction,
	authUserId: string,
	afterId?: string,
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
				eq(participationGrant.capability, "entity.security"),
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
