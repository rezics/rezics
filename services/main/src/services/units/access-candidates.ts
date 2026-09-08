import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Authorization } from "../authorization";
import { database } from "../database";
import { authEntity, entityIdentity, users } from "../database/schema";
import { searchDomainIdentifiers } from "../search/service";
import { readUnitPresentationsInTransaction } from "./presentation-reader";
/** Collaborator discovery searches public native names, then resolves only the selected bounded self-Entity set to private principals. */
export async function listNativeAccessCandidates(
	authorization: Authorization<string>,
	input: {
		unitId: string;
		kind: "auth" | "realm";
		query?: string;
		cursor?: string;
		limit: number;
		permission?: "unit.access.manage" | "unit.ownership.transfer";
	},
) {
	const permission = input.permission ?? "unit.access.manage";
	await authorization.unit.ensure(input.unitId, permission);
	if (!input.query?.trim() && !input.cursor) return { items: [], nextCursor: null };
	const page = await searchDomainIdentifiers(input.kind === "auth" ? "entities" : "realms", {
		query: input.query,
		limit: input.limit,
		cursor: input.cursor,
		profileId: authorization.profileId,
	});
	return database.transaction(
		async (tx) => {
			await authorization.unit.ensureInTransaction(tx, input.unitId, permission);
			const ids = page.hits.map((hit) => hit.id);
			if (!ids.length) return { items: [], nextCursor: page.nextCursor ?? null };
			if (input.kind === "auth") {
				const accounts = await tx
					.select({ authUserId: authEntity.authUserId, entityId: authEntity.entityId })
					.from(authEntity)
					.innerJoin(users, eq(users.id, authEntity.authUserId))
					.innerJoin(entityIdentity, eq(entityIdentity.id, authEntity.entityId))
					.where(
						and(
							inArray(authEntity.entityId, ids),
							eq(authEntity.state, "active"),
							isNull(users.erasedAt),
							eq(entityIdentity.status, "published"),
							eq(entityIdentity.visibility, "public"),
							eq(entityIdentity.moderationStatus, "approved"),
							isNull(entityIdentity.deletedAt),
						),
					)
					.limit(ids.length);
				const labels = await readUnitPresentationsInTransaction(
					tx,
					accounts.map((row) => row.entityId),
				);
				const byId = new Map(accounts.map((row) => [row.entityId, row]));
				return {
					items: ids.flatMap((id) => {
						const account = byId.get(id);
						return account
							? [
									{
										entityId: account.entityId,
										subject: { kind: "auth" as const, authUserId: account.authUserId },
										label: labels.get(id)?.title ?? null,
									},
								]
							: [];
					}),
					nextCursor: page.nextCursor ?? null,
				};
			}
			const readable = await authorization.unit.readableUnitIdsInTransaction(tx, ids);
			const labels = await readUnitPresentationsInTransaction(tx, [...readable]);
			return {
				items: ids.flatMap((id) =>
					readable.has(id)
						? [
								{
									entityId: null,
									subject: { kind: "realm" as const, realmId: id, relation: "member" as const },
									label: labels.get(id)?.title ?? null,
								},
							]
						: [],
				),
				nextCursor: page.nextCursor ?? null,
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}
