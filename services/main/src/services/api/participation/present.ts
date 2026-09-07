import { and, eq } from "drizzle-orm";
import { CatalogReferenceSchema } from "../../catalog/contracts";
import type { DatabaseTransaction } from "../../database";
import { authEntity, type participationGrant } from "../../database/schema/participation";
import { CatalogNameTables } from "../../database/schema/catalog-names";
import { ParticipationDenied, type ParticipationAuthority } from "../../participation/policy";
import { avatarReferenceFromColumns } from "../../units/localization";
import { readEntityPresentationRevision } from "../../participation/presentation";
import { ParticipationGrantSchema } from "./schema";

/** Native rows remain private; the wire contract exposes capabilities and public targets only. */
export function presentParticipationGrant(row: typeof participationGrant.$inferSelect) {
	const targets = Object.entries({
		publishing: row.publishingId,
		music: row.musicId,
		program: row.programId,
		software: row.softwareId,
		entity: row.entityId,
		grouping: row.groupingId,
		reference: row.referenceId,
		distribution: row.distributionId,
	}).filter(([, id]) => id !== null);
	const target = targets[0];
	if (!target || targets.length !== 1) throw new Error("Participation grant target is invalid");
	return ParticipationGrantSchema.parse({
		id: row.id,
		revision: row.revision,
		actingEntityId: row.actingEntityId,
		capability: row.capability,
		target: CatalogReferenceSchema.parse({ owner: target[0], id: target[1] }),
		proposal:
			row.proposalId === null
				? null
				: { sourceRecordId: row.proposalSourceRecordId, proposalId: row.proposalId },
		createdAt: row.createdAt.toISOString(),
		expiresAt: row.expiresAt?.toISOString() ?? null,
		revokedAt: row.revokedAt?.toISOString() ?? null,
	});
}

/** Resolves an already admitted public self identity; cataloging a person never creates this binding. */
export async function accountRecipientForEntity(tx: DatabaseTransaction, entityId: string) {
	const [binding] = await tx
		.select({ authUserId: authEntity.authUserId })
		.from(authEntity)
		.where(and(eq(authEntity.entityId, entityId), eq(authEntity.state, "active")))
		.limit(1);
	if (!binding) throw new ParticipationDenied("Recipient has no active account participation");
	return { kind: "auth" as const, authUserId: binding.authUserId };
}

export async function presentEntityPresentationRevision(
	tx: DatabaseTransaction,
	authority: ParticipationAuthority,
	language: string,
	revision: number,
) {
	const snapshot = await readEntityPresentationRevision(tx, authority, language, revision);
	const names = CatalogNameTables.entity.nameRevision;
	const [name] =
		snapshot.nameId === null || snapshot.nameRevision === null
			? []
			: await tx
					.select({ id: names.id, revision: names.revision, value: names.value })
					.from(names)
					.where(
						and(
							eq(names.ownerId, snapshot.entityId),
							eq(names.id, snapshot.nameId),
							eq(names.revision, snapshot.nameRevision),
						),
					)
					.limit(1);
	if (snapshot.nameId !== null && !name)
		throw new Error("Selected presentation name revision is missing");
	return {
		entityId: snapshot.entityId,
		language: snapshot.language,
		revision: snapshot.revision,
		name: name ?? null,
		avatar: avatarReferenceFromColumns(snapshot),
		bannerAssetId: snapshot.bannerAssetId,
		summary: snapshot.summary,
		description: snapshot.description,
	};
}
