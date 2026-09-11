import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Authorization } from "../authorization";
import type { DatabaseTransaction } from "../database";
import { realmMember, unitOwnership, RealmMemberStateValues } from "../database/schema";
import { getPublicEntitySummariesByIds } from "../participation/presentation";
import { getPublicCanonicalUnitSlugAddresses } from "../units/slug-address";
import { admitRealmAccount } from "./account";
import {
	RealmRosterCandidateLimit,
	RealmRosterPageLimit,
	type RealmRosterQuery,
} from "./roster-contracts";

/** Bound candidate work before optional state filtering, then hydrate public native presentation. @internal */
export async function listRealmMembers(
	tx: DatabaseTransaction,
	authorization: Authorization<string>,
	realmId: string,
	query: RealmRosterQuery,
) {
	z.uuid().parse(realmId);
	const limit = z
		.number()
		.int()
		.min(1)
		.max(RealmRosterPageLimit)
		.parse(query.limit ?? 50);
	const profileId = query.profileId ? z.uuid().parse(query.profileId) : undefined;
	const afterProfileId = query.afterProfileId ? z.uuid().parse(query.afterProfileId) : undefined;
	const state = query.state ? z.enum(RealmMemberStateValues).parse(query.state) : undefined;
	await admitRealmAccount(tx, authorization, "read");
	await authorization.realm.ensureCapabilityInTransaction(tx, realmId, "realm.members.read");
	const [ownership] = await tx
		.select({ profileId: unitOwnership.profileId })
		.from(unitOwnership)
		.where(and(eq(unitOwnership.unitId, realmId), isNull(unitOwnership.revokedAt)))
		.limit(1);
	const candidateLimit = state ? RealmRosterCandidateLimit : limit;
	const rows = await tx
		.select({
			profileId: realmMember.profileId,
			state: realmMember.state,
			joinedAt: realmMember.joinedAt,
		})
		.from(realmMember)
		.where(
			and(
				eq(realmMember.realmId, realmId),
				profileId ? eq(realmMember.profileId, profileId) : undefined,
				afterProfileId ? gt(realmMember.profileId, afterProfileId) : undefined,
			),
		)
		.orderBy(realmMember.profileId)
		.limit(candidateLimit + 1);
	const selected: (typeof rows)[number][] = [];
	let consumed = 0;
	for (const row of rows.slice(0, candidateLimit)) {
		consumed++;
		if (!state || row.state === state) selected.push(row);
		if (selected.length === limit) break;
	}
	// Advance over filtered rows too; an empty page can still have more candidates.
	const nextCursor = consumed < rows.length ? (rows[consumed - 1]?.profileId ?? null) : null;
	const presentation = await getPublicEntitySummariesByIds(
		selected.map((row) => row.profileId),
		query.localizationLanguages ?? [],
		tx,
	);
	const addresses = await getPublicCanonicalUnitSlugAddresses([...presentation.keys()], tx);
	return {
		items: selected.map((row) => ({
			...row,
			name: presentation.get(row.profileId)?.title ?? null,
			language: presentation.get(row.profileId)?.language ?? null,
			avatar: presentation.get(row.profileId)?.avatar ?? null,
			slugAddress: addresses.get(row.profileId) ?? null,
			isOwner: ownership?.profileId === row.profileId,
		})),
		nextCursor,
	};
}
