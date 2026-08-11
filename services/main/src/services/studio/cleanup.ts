import { sql } from "drizzle-orm";

import { database } from "../database";

type CleanupCount = { readonly count: number | string };

function cleanupCount(value: number | string | undefined): number {
	const parsed = Number(value ?? 0);
	if (!Number.isSafeInteger(parsed) || parsed < 0)
		throw new TypeError("Studio candidate cleanup returned an invalid count");
	return parsed;
}

/** Removes expired projection rows in two bounded, lock-skipping batches. */
export async function cleanupExpiredStudioEditorCandidates(input: {
	readonly batchSize: number;
	readonly now?: Date;
}): Promise<number> {
	const now = input.now ?? new Date();
	if (Number.isNaN(now.getTime())) throw new TypeError("Studio candidate cleanup time is invalid");
	if (!Number.isSafeInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 10_000)
		throw new RangeError("Studio candidate cleanup batch size must be between 1 and 10,000");

	return database.transaction(async (tx) => {
		const profileResult = await tx.execute<CleanupCount>(sql`
			with batch as materialized (
				select profile_id, unit_id
				from studio_profile_editor_candidate
				where valid_until <= ${now}
				order by valid_until, profile_id, unit_id
				limit ${input.batchSize}
				for update skip locked
			), deleted as (
				delete from studio_profile_editor_candidate candidate
				using batch
				where candidate.profile_id = batch.profile_id
					and candidate.unit_id = batch.unit_id
					and candidate.valid_until <= ${now}
				returning 1
			)
			select count(*)::int as count from deleted
		`);
		const realmResult = await tx.execute<CleanupCount>(sql`
			with batch as materialized (
				select realm_id, realm_relation, unit_id
				from studio_realm_editor_candidate
				where valid_until <= ${now}
				order by valid_until, realm_id, realm_relation, unit_id
				limit ${input.batchSize}
				for update skip locked
			), deleted as (
				delete from studio_realm_editor_candidate candidate
				using batch
				where candidate.realm_id = batch.realm_id
					and candidate.realm_relation = batch.realm_relation
					and candidate.unit_id = batch.unit_id
					and candidate.valid_until <= ${now}
				returning 1
			)
			select count(*)::int as count from deleted
		`);
		return cleanupCount(profileResult.rows[0]?.count) + cleanupCount(realmResult.rows[0]?.count);
	});
}
