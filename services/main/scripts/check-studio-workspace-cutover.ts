import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import type { UnitMergeGraphPlanV1 } from "../src/services/database/schema";
import { processUnitMergePhase } from "../src/services/units/merge/phase-handlers";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const ProfileId = "71000000-0000-7000-8000-000000000001";
const ProfileAuthUserId = "71000000-0000-7000-8000-000000000002";
const SourceUnitId = "71000000-0000-7000-8000-000000000003";
const TargetUnitId = "71000000-0000-7000-8000-000000000004";
const ExpiredCandidateUnitId = "71000000-0000-7000-8000-000000000005";
const RealmUnitId = "71000000-0000-7000-8000-000000000006";
const OwnershipId = "71000000-0000-7000-8000-000000000007";
const ProfileGrantId = "71000000-0000-7000-8000-000000000008";
const RealmGrantId = "71000000-0000-7000-8000-000000000009";
const ExpiredProfileGrantId = "71000000-0000-7000-8000-000000000010";
const CreatedRelationId = "71000000-0000-7000-8000-000000000011";
const UnitRevisionRelationId = "71000000-0000-7000-8000-000000000012";
const DockRevisionRelationId = "71000000-0000-7000-8000-000000000013";
const OperationId = "71000000-0000-7000-8000-000000000014";

const CreatedResourceAt = "2026-01-01T00:00:00.000Z";
const OwnerSince = "2026-01-02T00:00:00.000Z";
const FirstContributedAt = "2026-01-02T00:00:00.000Z";
const DirectGrantSince = "2026-01-03T00:00:00.000Z";
const RealmGrantSince = "2026-01-04T00:00:00.000Z";
const LastContributedAt = "2026-01-06T00:00:00.000Z";
const FutureExpiry = "2099-01-01T00:00:00.000Z";
const TargetCreatedResourceAt = "2025-12-30T00:00:00.000Z";
const TargetFirstContributedAt = "2025-12-31T00:00:00.000Z";
const TargetLastContributedAt = "2026-01-05T00:00:00.000Z";

type ParticipationRow = {
	readonly contributionCount: string;
	readonly createdResourceAt: Date | null;
	readonly firstContributedAt: Date | null;
	readonly lastContributedAt: Date | null;
	readonly lastParticipatedAt: Date;
};

type ProfileCandidateRow = {
	readonly directGrantLastAt: Date | null;
	readonly directGrantSince: Date | null;
	readonly ownerSince: Date | null;
	readonly relevantAt: Date;
	readonly validUntil: Date | null;
};

type RealmCandidateRow = {
	readonly grantSince: Date;
	readonly relevantAt: Date;
	readonly validUntil: Date | null;
};

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function assertTimestamp(
	actual: Date | null,
	expected: string,
	message: string,
): asserts actual is Date {
	assert(actual instanceof Date, `${message}: expected a timestamp`);
	assert(
		actual.toISOString() === expected,
		`${message}: expected ${expected}, received ${actual.toISOString()}`,
	);
}

async function assertDisposableDatabase(client: Client): Promise<void> {
	assert(
		process.env[FixtureFlag] === "1",
		`${FixtureFlag}=1 is required because this check writes destructive fixtures`,
	);
	const result = await client.query<{ readonly database: string }>(
		"select current_database() as database",
	);
	assert(
		result.rows[0]?.database === "rezics_atlas",
		"Studio workspace cutover fixtures may run only in the disposable rezics_atlas database",
	);
}

async function relationExists(client: Client, relation: string): Promise<boolean> {
	const result = await client.query<{ readonly exists: boolean }>(
		"select to_regclass($1) is not null as exists",
		[`public.${relation}`],
	);
	return result.rows[0]?.exists === true;
}

async function seed(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	assert(
		await relationExists(client, "studio_work_relation"),
		"Studio workspace cutover seed requires the released studio_work_relation schema",
	);
	assert(
		!(await relationExists(client, "profile_resource_participation")),
		"Studio workspace cutover seed must run before the participation migration",
	);

	const existing = await client.query<{ readonly exists: boolean }>(
		"select exists (select 1 from public.unit where id = $1::uuid) as exists",
		[SourceUnitId],
	);
	assert(existing.rows[0]?.exists === false, "Studio workspace cutover fixture already exists");

	await client.query("begin");
	try {
		await client.query("set local session_replication_role = replica");
		await client.query(
			`insert into public.profile (id, auth_user_id, joined_at, created_at, updated_at)
			values ($1, $2, $3, $3, $3)`,
			[ProfileId, ProfileAuthUserId, CreatedResourceAt],
		);
		await client.query(
			`insert into public.unit (id, kind, created_at, updated_at)
			values
				($1, 'book', $5, $5),
				($2, 'book', $5, $5),
				($3, 'book', $5, $5),
				($4, 'realm', $5, $5)`,
			[SourceUnitId, TargetUnitId, ExpiredCandidateUnitId, RealmUnitId, CreatedResourceAt],
		);
		await client.query("insert into public.realm (id) values ($1)", [RealmUnitId]);
		await client.query(
			`insert into public.unit_ownership
				(id, unit_id, profile_id, assigned_by_profile_id, created_at, updated_at)
			values ($1, $2, $3, $3, $4, $4)`,
			[OwnershipId, SourceUnitId, ProfileId, OwnerSince],
		);
		await client.query(
			`insert into public.unit_access_grant (
				id,
				unit_id,
				subject_kind,
				profile_id,
				realm_id,
				realm_relation,
				permission,
				granted_by_profile_id,
				expires_at,
				created_at,
				updated_at
			) values
				($1, $4, 'profile', $6, null, null, 'unit.update', $6, $10, $7, $7),
				($2, $4, 'realm', null, $5, 'member', 'unit.update', $6, $10, $8, $8),
				($3, $9, 'profile', $6, null, null, 'unit.update', $6,
					'2025-01-02T00:00:00.000Z', '2025-01-01T00:00:00.000Z',
					'2025-01-01T00:00:00.000Z')`,
			[
				ProfileGrantId,
				RealmGrantId,
				ExpiredProfileGrantId,
				SourceUnitId,
				RealmUnitId,
				ProfileId,
				DirectGrantSince,
				RealmGrantSince,
				ExpiredCandidateUnitId,
				FutureExpiry,
			],
		);
		await client.query(
			`insert into public.studio_work_relation (
				id,
				profile_id,
				resource_unit_id,
				authorization_unit_id,
				authorization_scope,
				authorization_scope_key,
				relation,
				source,
				first_at,
				last_at,
				activity_count,
				created_at
			) values
				($1, $4, $5, $5, null, '*', 'created', 'unit_status', $6, $6, 1, $6),
				($2, $4, $5, $5, null, '*', 'contributed', 'unit_revision', $7,
					'2026-01-04T00:00:00.000Z', 3, $7),
				($3, $4, $5, $5, null, '*', 'contributed', 'dock_revision', $8, $9, 2, $8)`,
			[
				CreatedRelationId,
				UnitRevisionRelationId,
				DockRevisionRelationId,
				ProfileId,
				SourceUnitId,
				CreatedResourceAt,
				FirstContributedAt,
				DirectGrantSince,
				LastContributedAt,
			],
		);
		await client.query("commit");
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
	console.info("Seeded released Studio workspace fixtures.");
}

async function readParticipation(
	client: Client,
	unitId: string,
): Promise<ParticipationRow | undefined> {
	const result = await client.query<ParticipationRow>(
		`select
			created_resource_at as "createdResourceAt",
			first_contributed_at as "firstContributedAt",
			last_contributed_at as "lastContributedAt",
			contribution_count::text as "contributionCount",
			last_participated_at as "lastParticipatedAt"
		from public.profile_resource_participation
		where profile_id = $1::uuid and resource_unit_id = $2::uuid`,
		[ProfileId, unitId],
	);
	assert(result.rows.length <= 1, `Participation fixture is not unique for Unit ${unitId}`);
	return result.rows[0];
}

function assertParticipation(
	actual: ParticipationRow | undefined,
	expected: {
		readonly contributionCount: string;
		readonly createdResourceAt: string;
		readonly firstContributedAt: string;
		readonly lastContributedAt: string;
		readonly lastParticipatedAt: string;
	},
	message: string,
): void {
	assert(actual, `${message}: row is missing`);
	assertTimestamp(actual.createdResourceAt, expected.createdResourceAt, `${message} created time`);
	assertTimestamp(
		actual.firstContributedAt,
		expected.firstContributedAt,
		`${message} first contribution`,
	);
	assertTimestamp(
		actual.lastContributedAt,
		expected.lastContributedAt,
		`${message} last contribution`,
	);
	assertTimestamp(
		actual.lastParticipatedAt,
		expected.lastParticipatedAt,
		`${message} last participation`,
	);
	assert(
		actual.contributionCount === expected.contributionCount,
		`${message} contribution count: expected ${expected.contributionCount}, received ${actual.contributionCount}`,
	);
}

async function assertCutoverProjection(client: Client): Promise<void> {
	assert(
		!(await relationExists(client, "studio_work_relation")),
		"The retired studio_work_relation table still exists",
	);
	for (const relation of [
		"profile_resource_participation",
		"studio_profile_editor_candidate",
		"studio_realm_editor_candidate",
	]) {
		assert(await relationExists(client, relation), `Cutover relation is missing: ${relation}`);
	}

	assertParticipation(
		await readParticipation(client, SourceUnitId),
		{
			createdResourceAt: CreatedResourceAt,
			firstContributedAt: FirstContributedAt,
			lastContributedAt: LastContributedAt,
			contributionCount: "5",
			lastParticipatedAt: LastContributedAt,
		},
		"Studio participation backfill",
	);

	const profileCandidate = await client.query<ProfileCandidateRow>(
		`select
			owner_since as "ownerSince",
			direct_grant_since as "directGrantSince",
			direct_grant_last_at as "directGrantLastAt",
			relevant_at as "relevantAt",
			valid_until as "validUntil"
		from public.studio_profile_editor_candidate
		where profile_id = $1::uuid and unit_id = $2::uuid`,
		[ProfileId, SourceUnitId],
	);
	assert(profileCandidate.rows.length === 1, "Profile editor candidate was not backfilled");
	const profileRow = profileCandidate.rows[0];
	assert(profileRow, "Profile editor candidate row is missing");
	assertTimestamp(profileRow.ownerSince, OwnerSince, "Profile candidate ownership time");
	assertTimestamp(
		profileRow.directGrantSince,
		DirectGrantSince,
		"Profile candidate first direct grant",
	);
	assertTimestamp(
		profileRow.directGrantLastAt,
		DirectGrantSince,
		"Profile candidate last direct grant",
	);
	assertTimestamp(profileRow.relevantAt, DirectGrantSince, "Profile candidate relevance time");
	assert(profileRow.validUntil === null, "An active owner candidate must not expire");

	const realmCandidate = await client.query<RealmCandidateRow>(
		`select
			grant_since as "grantSince",
			relevant_at as "relevantAt",
			valid_until as "validUntil"
		from public.studio_realm_editor_candidate
		where realm_id = $1::uuid and realm_relation = 'member' and unit_id = $2::uuid`,
		[RealmUnitId, SourceUnitId],
	);
	assert(realmCandidate.rows.length === 1, "Realm editor candidate was not backfilled");
	const realmRow = realmCandidate.rows[0];
	assert(realmRow, "Realm editor candidate row is missing");
	assertTimestamp(realmRow.grantSince, RealmGrantSince, "Realm candidate first grant");
	assertTimestamp(realmRow.relevantAt, RealmGrantSince, "Realm candidate relevance time");
	assertTimestamp(realmRow.validUntil, FutureExpiry, "Realm candidate expiry");

	const expiredCandidate = await client.query<{ readonly exists: boolean }>(
		`select exists (
			select 1 from public.studio_profile_editor_candidate
			where profile_id = $1::uuid and unit_id = $2::uuid
		) as exists`,
		[ProfileId, ExpiredCandidateUnitId],
	);
	assert(
		expiredCandidate.rows[0]?.exists === false,
		"Expired direct grant was incorrectly backfilled as a Studio candidate",
	);
}

async function assertUnitMergeCutover(client: Client): Promise<void> {
	await client.query(
		`insert into public.profile_resource_participation (
			profile_id,
			resource_unit_id,
			created_resource_at,
			first_contributed_at,
			last_contributed_at,
			contribution_count,
			last_participated_at,
			projection_updated_at
		) values ($1, $2, $3, $4, $5, 7, $5, $6)`,
		[
			ProfileId,
			TargetUnitId,
			TargetCreatedResourceAt,
			TargetFirstContributedAt,
			TargetLastContributedAt,
			LastContributedAt,
		],
	);

	const graphPlan = {
		version: 1,
		sourceRole: "standalone",
		targetRole: "standalone",
		sourceMainUnitId: null,
		targetMainUnitId: null,
		destinationMainUnitId: null,
		action: "none",
	} as const satisfies UnitMergeGraphPlanV1;
	const mergeInput = {
		operationId: OperationId,
		sourceUnitId: SourceUnitId,
		targetUnitId: TargetUnitId,
		graphPlan,
		batchSize: 100,
	} as const;
	const database = drizzle({ client });
	const firstResult = await database.transaction((transaction) =>
		processUnitMergePhase(transaction, "derived_state", mergeInput),
	);
	assert(
		!firstResult.done,
		"Unit merge derived-state phase must request a confirmation pass after processing rows",
	);
	assert(
		firstResult.processedRows === 3,
		`Unit merge derived-state phase processed ${firstResult.processedRows} rows instead of 3`,
	);

	assertParticipation(
		await readParticipation(client, TargetUnitId),
		{
			createdResourceAt: TargetCreatedResourceAt,
			firstContributedAt: TargetFirstContributedAt,
			lastContributedAt: LastContributedAt,
			contributionCount: "12",
			lastParticipatedAt: LastContributedAt,
		},
		"Unit merge participation projection",
	);
	assert(
		(await readParticipation(client, SourceUnitId)) === undefined,
		"Unit merge left source participation behind",
	);

	const sourceCandidates = await client.query<{ readonly count: string }>(
		`select (
			(select count(*) from public.studio_profile_editor_candidate where unit_id = $1::uuid)
			+ (select count(*) from public.studio_realm_editor_candidate where unit_id = $1::uuid)
		)::text as count`,
		[SourceUnitId],
	);
	assert(
		sourceCandidates.rows[0]?.count === "0",
		"Unit merge left source Studio editor candidates behind",
	);

	const retryResult = await database.transaction((transaction) =>
		processUnitMergePhase(transaction, "derived_state", mergeInput),
	);
	assert(retryResult.done, "Unit merge derived-state retry did not converge");
	assert(
		retryResult.processedRows === 0,
		`Unit merge derived-state retry unexpectedly processed ${retryResult.processedRows} rows`,
	);
	assertParticipation(
		await readParticipation(client, TargetUnitId),
		{
			createdResourceAt: TargetCreatedResourceAt,
			firstContributedAt: TargetFirstContributedAt,
			lastContributedAt: LastContributedAt,
			contributionCount: "12",
			lastParticipatedAt: LastContributedAt,
		},
		"Idempotent Unit merge participation projection",
	);
}

async function clean(client: Client): Promise<void> {
	await client.query("begin");
	try {
		await client.query("set local session_replication_role = replica");
		await client.query(
			"delete from public.profile_resource_participation where profile_id = $1::uuid",
			[ProfileId],
		);
		await client.query(
			"delete from public.studio_profile_editor_candidate where profile_id = $1::uuid",
			[ProfileId],
		);
		await client.query(
			"delete from public.studio_realm_editor_candidate where realm_id = $1::uuid",
			[RealmUnitId],
		);
		await client.query("delete from public.unit_access_grant where id = any($1::uuid[])", [
			[ProfileGrantId, RealmGrantId, ExpiredProfileGrantId],
		]);
		await client.query("delete from public.unit_ownership where id = $1::uuid", [OwnershipId]);
		await client.query("delete from public.realm where id = $1::uuid", [RealmUnitId]);
		await client.query("delete from public.unit where id = any($1::uuid[])", [
			[SourceUnitId, TargetUnitId, ExpiredCandidateUnitId, RealmUnitId],
		]);
		await client.query("delete from public.profile where id = $1::uuid", [ProfileId]);
		await client.query("commit");
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
}

async function verifyAndClean(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	await assertCutoverProjection(client);
	await assertUnitMergeCutover(client);
	await clean(client);
	console.info("Verified and removed Studio workspace cutover fixtures.");
}

const mode = process.argv[2];
assert(mode === "seed" || mode === "verify-and-clean", "Expected seed or verify-and-clean");
const databaseUrl = process.env.DATABASE_ADMIN_URL;
assert(databaseUrl, "DATABASE_ADMIN_URL is required");
const client = new Client({
	connectionString: databaseUrl,
	application_name: "rezics-studio-cutover-check",
});
await client.connect();
try {
	if (mode === "seed") await seed(client);
	else await verifyAndClean(client);
} finally {
	await client.end();
}
