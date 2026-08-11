import { sql } from "drizzle-orm";

import { database } from "../database";
import { studioProfileEditorCandidate, studioRealmEditorCandidate } from "../database/schema";

/**
 * Maintenance-only rebuild of Studio's current editor candidate indexes.
 *
 * Normal writes are maintained by access-table triggers. Candidate-table locks
 * serialize those small trigger updates behind the rebuild without placing a
 * global advisory lock on every access mutation.
 */
export async function rebuildStudioEditorCandidates(): Promise<void> {
	await database.transaction(async (tx) => {
		await tx.execute(sql`set local statement_timeout = 0`);
		await tx.execute(sql`
			lock table
				studio_profile_editor_candidate,
				studio_realm_editor_candidate
			in access exclusive mode
		`);
		await tx.delete(studioProfileEditorCandidate);
		await tx.delete(studioRealmEditorCandidate);
		await tx.execute(sql`
			with editor_source as (
				select
					ownership.profile_id,
					ownership.unit_id,
					ownership.created_at as owner_since,
					null::timestamptz as direct_grant_since,
					null::timestamptz as direct_grant_last_at,
					ownership.created_at as relevant_at,
					true as non_expiring,
					null::timestamptz as expires_at
				from unit_ownership ownership
				where ownership.revoked_at is null

				union all

				select
					access_grant.profile_id,
					access_grant.unit_id,
					null,
					access_grant.created_at,
					access_grant.created_at,
					access_grant.created_at,
					access_grant.expires_at is null,
					access_grant.expires_at
				from unit_access_grant access_grant
				where access_grant.subject_kind = 'profile'
					and access_grant.profile_id is not null
					and access_grant.permission = 'unit.update'
					and access_grant.revoked_at is null
					and (access_grant.expires_at is null or access_grant.expires_at > now())
			)
			insert into studio_profile_editor_candidate (
				profile_id,
				unit_id,
				owner_since,
				direct_grant_since,
				direct_grant_last_at,
				relevant_at,
				valid_until
			)
			select
				profile_id,
				unit_id,
				min(owner_since),
				min(direct_grant_since),
				max(direct_grant_last_at),
				max(relevant_at),
				case when bool_or(non_expiring) then null else max(expires_at) end
			from editor_source
			group by profile_id, unit_id
		`);
		await tx.execute(sql`
			insert into studio_realm_editor_candidate (
				realm_id,
				realm_relation,
				unit_id,
				grant_since,
				relevant_at,
				valid_until
			)
			select
				access_grant.realm_id,
				access_grant.realm_relation,
				access_grant.unit_id,
				min(access_grant.created_at),
				max(access_grant.created_at),
				case
					when bool_or(access_grant.expires_at is null) then null
					else max(access_grant.expires_at)
				end
			from unit_access_grant access_grant
			where access_grant.subject_kind = 'realm'
				and access_grant.realm_id is not null
				and access_grant.realm_relation is not null
				and access_grant.permission = 'unit.update'
				and access_grant.revoked_at is null
				and (access_grant.expires_at is null or access_grant.expires_at > now())
			group by
				access_grant.realm_id,
				access_grant.realm_relation,
				access_grant.unit_id
		`);
	});
}
