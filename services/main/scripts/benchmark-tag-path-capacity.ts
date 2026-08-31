import { Client } from "pg";

import {
	assertBoundedPostgreSqlPlan,
	decodePostgreSqlExplainPlan,
	hasPostgreSqlErrorCode,
	readPositiveIntegerFlag,
	requireDisposableTagPathDatabase,
	summarizeLatencies,
	type LatencySummary,
	type PlanSummary,
	type PostgreSqlExplainPlan,
} from "./tag-path-capacity-contract";

type ApplicationAuthority = "global" | "realm";
type WorkloadAuthority = ApplicationAuthority | "public-position";

type FixtureIdentity = Readonly<{
	readonly hotExpressionId: string;
	readonly hotGlobalApplicationId: string;
	readonly hotPathId: string;
	readonly hotRealmApplicationId: string;
	readonly hotUnitId: string;
	readonly profileIds: readonly string[];
	readonly realmId: string;
	readonly terminalTagId: string;
}>;

type HotWriteSummary = Readonly<{
	readonly authority: WorkloadAuthority;
	readonly attempts: number;
	readonly backpressure: number;
	readonly backpressureDecisionLatency: LatencySummary;
	readonly commits: number;
	readonly deadlocks: number;
	readonly elapsedMilliseconds: number;
	readonly lockWaitP95Milliseconds: 0;
	readonly poolUtilization: number;
	readonly terminalLatency: LatencySummary;
	readonly throughputPerSecond: number;
	readonly timeouts: number;
	readonly unexpected: number;
	readonly unexpectedErrors: readonly string[];
	readonly walBytes: number;
}>;

type PlanEvidence = Readonly<{
	readonly executionMilliseconds: number;
	readonly planningMilliseconds: number;
	readonly summary: PlanSummary;
}>;

type RelationStorage = Readonly<{
	readonly estimated500MillionBytes: number;
	readonly estimated3BillionBytes: number;
	readonly indexBytes: number;
	readonly relation: string;
	readonly rowCount: number;
	readonly totalBytes: number;
	readonly totalBytesPerRow: number;
}>;

const FixtureTable = "tag_path_capacity_fixture_v2" as const;
const FixturePathTable = "tag_path_capacity_path_v2" as const;
const FixtureJudgmentBatchSize = 25 as const;
const HotKeyMaximumRetries = 2 as const;
const ProjectionHotKeyMaximumRetries = 3 as const;
const AcceptedApplicationsPerUnit = 3 as const;
const HotPathMemberCount = 16 as const;
const CapacityRelations = [
	"tag_path",
	"tag_path_member",
	"tag_public_position_stat",
	"tag_path_sense",
	"tag_path_sense_binding",
	"tag_expression",
	"tag_expression_argument",
	"tag_expression_inference_rule",
	"tag_expression_effective_tag",
	"unit_tag_path_application",
	"unit_tag_path_application_judgment",
	"unit_tag_path_application_judgment_stat",
	"unit_expression_assertion",
	"unit_effective_tag",
	"realm_tag_path",
	"realm_tag_path_sense",
	"realm_unit_tag_path_application",
	"realm_unit_tag_path_application_judgment",
	"realm_unit_tag_path_application_judgment_stat",
	"realm_unit_expression_assertion",
	"realm_unit_effective_tag",
] as const;

function requireMinimum(name: string, value: number, minimum: number): number {
	if (value < minimum) throw new RangeError(name + " must be at least " + minimum);
	return value;
}

function requireRow<T>(rows: readonly T[], context: string): T {
	const row = rows[0];
	if (row === undefined) throw new Error(context + " returned no row");
	return row;
}

function describeDatabaseError(error: unknown): string {
	if (!(error instanceof Error)) return String(error);
	const code =
		typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
			? error.code + ": "
			: "";
	return code + error.message;
}

async function currentWalLsn(client: Client): Promise<string> {
	const result = await client.query<{ readonly lsn: string }>(
		"select pg_current_wal_lsn()::text as lsn",
	);
	return requireRow(result.rows, "PostgreSQL WAL position").lsn;
}

async function walBytesBetween(client: Client, start: string, end: string): Promise<number> {
	const result = await client.query<{ readonly bytes: string }>(
		"select pg_wal_lsn_diff($1::pg_lsn, $2::pg_lsn)::text as bytes",
		[end, start],
	);
	return Number(requireRow(result.rows, "PostgreSQL WAL difference").bytes);
}

async function loadFixture(
	client: Client,
	input: {
		readonly pathCount: number;
		readonly profileCount: number;
		readonly unitCount: number;
	},
): Promise<Readonly<{ readonly milliseconds: number; readonly walBytes: number }>> {
	const walStart = await currentWalLsn(client);
	const startedAt = performance.now();
	const tagCount = input.pathCount + HotPathMemberCount;
	await client.query("begin");
	try {
		await client.query("set local statement_timeout = 0");
		await client.query("set local synchronous_commit = off");
		await client.query(`
			create unlogged table public.${FixtureTable} (
				kind text not null,
				ordinal integer not null,
				id uuid not null,
				primary key (kind, ordinal),
				unique (id)
			)
		`);
		for (const fixture of [
			{ count: input.profileCount, kind: "profile" },
			{ count: input.unitCount, kind: "target" },
			{ count: tagCount, kind: "tag" },
			{ count: input.pathCount, kind: "path" },
			{ count: 1, kind: "realm" },
		] as const)
			await client.query(
				`insert into public.${FixtureTable}(kind, ordinal, id)
				 select $1::text, ordinal,
					md5('rezics-tag-path-capacity-v2:' || $1::text || ':' || ordinal::text)::uuid
				 from generate_series(0, $2::integer - 1) ordinal`,
				[fixture.kind, fixture.count],
			);

		await client.query(`
			create unlogged table public.${FixturePathTable} as
			with definitions as (
				select path.ordinal,
					path.id as path_id,
					md5('rezics-tag-path-capacity-v2:expression:' || path.ordinal::text)::uuid
						as expression_id,
					md5('rezics-tag-path-capacity-v2:sense:' || path.ordinal::text)::uuid
						as sense_id,
					case when path.ordinal = 0 then (
						select array_agg(tag.id order by tag.ordinal)
						from public.${FixtureTable} tag
						where tag.kind = 'tag' and tag.ordinal between 1 and 15
					) || array[(
						select id from public.${FixtureTable} where kind = 'tag' and ordinal = 0
					)]
					else array[
						(select id from public.${FixtureTable}
						 where kind = 'tag' and ordinal = 15 + path.ordinal),
						(select id from public.${FixtureTable} where kind = 'tag' and ordinal = 0)
					] end::uuid[] as member_node_ids
				from public.${FixtureTable} path
				where path.kind = 'path'
			)
			select definition.*,
				array(
					select md5(
						'rezics-tag-path-capacity-v2:relation:' || definition.ordinal::text || ':' ||
						edge.ordinal::text
					)::uuid
					from generate_series(0, cardinality(definition.member_node_ids) - 2) edge(ordinal)
					order by edge.ordinal
				)::uuid[] as relation_ids
			from definitions definition
		`);
		await client.query(`alter table public.${FixturePathTable} add primary key (ordinal)`);
		await client.query(`alter table public.${FixturePathTable} add unique (path_id)`);
		await client.query(`alter table public.${FixturePathTable} add unique (expression_id)`);
		await client.query(`alter table public.${FixturePathTable} add unique (sense_id)`);

		// Prerequisite released identities and their dense zero-count Tag rows are
		// disposable fixture scaffolding. Semantic definitions, applications,
		// judgments, and projection deltas below run through production owner triggers.
		await client.query("set local session_replication_role = replica");
		await client.query(`
			insert into public.unit(id, kind, status, visibility, published_at)
			select fixture.id,
				case fixture.kind
					when 'profile' then 'profile'
					when 'target' then 'book'
					when 'tag' then 'tag'
					when 'path' then 'tag_path'
					when 'realm' then 'realm'
				end,
				'published', 'public', now()
			from public.${FixtureTable} fixture
		`);
		await client.query(`
			insert into public.profile(id, auth_user_id)
			select id, md5('rezics-tag-path-capacity-v2:auth:' || ordinal::text)::uuid
			from public.${FixtureTable} where kind = 'profile'
		`);
		await client.query(`
			insert into public.vocabulary_node(id, kind)
			select id, 'concept' from public.${FixtureTable} where kind = 'tag'
		`);
		await client.query(`
			insert into public.tag(id)
			select id from public.${FixtureTable} where kind = 'tag'
		`);
		await client.query(`
			insert into public.tag_public_position_stat(tag_id)
			select id from public.${FixtureTable} where kind = 'tag'
		`);
		await client.query(`
			insert into public.realm(id, realm_tag_voting_enabled, enabled_pages)
			select id, true, array['main', 'tags']::public.realm_page_kind[]
			from public.${FixtureTable} where kind = 'realm'
		`);
		await client.query(`
			insert into public.realm_unit(realm_id, unit_id)
			select realm.id, target.id
			from public.${FixtureTable} realm
			cross join public.${FixtureTable} target
			where realm.kind = 'realm' and target.kind = 'target'
		`);
		await client.query("set local session_replication_role = origin");

		await client.query(`
			insert into public.tag_relation(
				id, parent_node_id, child_node_id, relation_kind, provenance, created_by_profile_id
			)
			select definition.relation_ids[edge.ordinal],
				definition.member_node_ids[edge.ordinal],
				definition.member_node_ids[edge.ordinal + 1],
				'generic', jsonb_build_object('fixture', 'tag-path-capacity-v2'), profile.id
			from public.${FixturePathTable} definition
			cross join lateral generate_subscripts(definition.relation_ids, 1) edge(ordinal)
			cross join public.${FixtureTable} profile
			where profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.tag_path(
				id, member_node_ids, relation_ids, structural_identity_hash,
				terminal_node_id, created_by_profile_id
			)
			select definition.path_id, definition.member_node_ids, definition.relation_ids,
				md5('rezics-tag-path-capacity-v2:path:' || definition.ordinal::text) ||
				md5('rezics-tag-path-capacity-v2:path:tail:' || definition.ordinal::text),
				definition.member_node_ids[cardinality(definition.member_node_ids)], profile.id
			from public.${FixturePathTable} definition
			cross join public.${FixtureTable} profile
			where profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.tag_expression(
				id, expression_kind, canonical_claim_key, focus_tag_id, created_by_profile_id
			)
			select definition.expression_id, 'facet_value',
				'capacity:facet-value:' || definition.ordinal::text,
				definition.member_node_ids[cardinality(definition.member_node_ids)], profile.id
			from public.${FixturePathTable} definition
			cross join public.${FixtureTable} profile
			where profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.tag_expression_argument(expression_id, role, ordinal, tag_id)
			select definition.expression_id, argument.role, 0,
				case argument.role
					when 'slot' then definition.member_node_ids[1]
					else definition.member_node_ids[cardinality(definition.member_node_ids)]
				end
			from public.${FixturePathTable} definition
			cross join (values ('slot'::text), ('value'::text)) argument(role)
		`);
		await client.query(`update public.tag_expression set sealed_at = now()`);
		await client.query(`
			insert into public.tag_expression_inference_rule(
				id, source_expression_id, target_tag_id, inference_kind,
				provenance, created_by_profile_id
			)
			select md5('rezics-tag-path-capacity-v2:inference:' || definition.ordinal::text)::uuid,
				definition.expression_id, definition.member_node_ids[1], 'retrieval_only',
				jsonb_build_object('fixture', 'tag-path-capacity-v2'), profile.id
			from public.${FixturePathTable} definition
			cross join public.${FixtureTable} profile
			where profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.tag_path_sense(
				id, path_id, expression_id, scope, binding_signature,
				provenance, created_by_profile_id
			)
			select definition.sense_id, definition.path_id, definition.expression_id, 'global',
				'slot:0;value:' || (cardinality(definition.member_node_ids) - 1)::text,
				jsonb_build_object('fixture', 'tag-path-capacity-v2'), profile.id
			from public.${FixturePathTable} definition
			cross join public.${FixtureTable} profile
			where profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.tag_path_sense_binding(
				sense_id, member_ordinal, argument_role, argument_ordinal
			)
			select definition.sense_id,
				case binding.role when 'slot' then 0 else cardinality(definition.member_node_ids) - 1 end,
				binding.role, 0
			from public.${FixturePathTable} definition
			cross join (values ('slot'::text), ('value'::text)) binding(role)
		`);
		await client.query(`update public.tag_path_sense set sealed_at = now()`);
		await client.query(`
			insert into public.tag_path_vote(path_id, profile_id, value)
			select definition.path_id, profile.id, 1
			from public.${FixturePathTable} definition
			cross join public.${FixtureTable} profile
			where profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.realm_tag_path(realm_id, path_id, created_by_profile_id)
			select realm.id, definition.path_id, profile.id
			from public.${FixturePathTable} definition
			cross join public.${FixtureTable} realm
			cross join public.${FixtureTable} profile
			where realm.kind = 'realm' and profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.realm_tag_path_vote(realm_id, path_id, profile_id, value)
			select realm.id, definition.path_id, profile.id, 1
			from public.${FixturePathTable} definition
			cross join public.${FixtureTable} realm
			cross join public.${FixtureTable} profile
			where realm.kind = 'realm' and profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.realm_tag_path_sense(realm_id, sense_id, path_id, created_by_profile_id)
			select realm.id, definition.sense_id, definition.path_id, profile.id
			from public.${FixturePathTable} definition
			cross join public.${FixtureTable} realm
			cross join public.${FixtureTable} profile
			where realm.kind = 'realm' and profile.kind = 'profile' and profile.ordinal = 0
		`);
		await client.query(`
			insert into public.unit_tag_path_application(
				id, unit_id, sense_id, created_by_profile_id, pinned, position
			)
			select md5(
					'rezics-tag-path-capacity-v2:global-application:' || target.ordinal::text || ':' ||
					definition.ordinal::text
				)::uuid,
				target.id, definition.sense_id, profile.id, true,
				'a' || lpad(definition.ordinal::text, 8, '0')
			from public.${FixtureTable} target
			cross join public.${FixturePathTable} definition
			cross join public.${FixtureTable} profile
			where target.kind = 'target' and profile.kind = 'profile' and profile.ordinal = 0
				and (target.ordinal = 0 or definition.ordinal < ${AcceptedApplicationsPerUnit})
		`);
		await client.query(`
			insert into public.realm_unit_tag_path_application(
				id, realm_id, unit_id, sense_id, created_by_profile_id
			)
			select md5(
					'rezics-tag-path-capacity-v2:realm-application:' || target.ordinal::text || ':' ||
					definition.ordinal::text
				)::uuid,
				realm.id, target.id, definition.sense_id, profile.id
			from public.${FixtureTable} realm
			cross join public.${FixtureTable} target
			cross join public.${FixturePathTable} definition
			cross join public.${FixtureTable} profile
			where realm.kind = 'realm' and target.kind = 'target'
				and profile.kind = 'profile' and profile.ordinal = 0
				and (target.ordinal = 0 or definition.ordinal < ${AcceptedApplicationsPerUnit})
		`);
		await client.query("commit");

		for (let batchStart = 0; batchStart < input.unitCount; batchStart += FixtureJudgmentBatchSize) {
			const batchEnd = Math.min(batchStart + FixtureJudgmentBatchSize, input.unitCount);
			await client.query("begin");
			await client.query("set local statement_timeout = 0");
			await client.query("set local synchronous_commit = off");
			await client.query(
				`
					insert into public.unit_tag_path_application_judgment(
						application_id, profile_id, fit_vote, spoiler_level,
						fit_updated_at, spoiler_updated_at
					)
					select application.id, profile.id, 1, target.ordinal % 3, now(), now()
					from public.${FixtureTable} target
					cross join public.${FixturePathTable} definition
					join public.unit_tag_path_application application
						on application.unit_id = target.id and application.sense_id = definition.sense_id
					cross join public.${FixtureTable} profile
					where target.kind = 'target' and definition.ordinal < ${AcceptedApplicationsPerUnit}
						and profile.kind = 'profile' and profile.ordinal = 0
						and target.ordinal >= $1 and target.ordinal < $2
				`,
				[batchStart, batchEnd],
			);
			await client.query(
				`
					insert into public.realm_unit_tag_path_application_judgment(
						application_id, profile_id, fit_vote, spoiler_level,
						fit_updated_at, spoiler_updated_at
					)
					select application.id, profile.id, 1, target.ordinal % 3, now(), now()
					from public.${FixtureTable} realm
					cross join public.${FixtureTable} target
					cross join public.${FixturePathTable} definition
					join public.realm_unit_tag_path_application application
						on application.realm_id = realm.id and application.unit_id = target.id
						and application.sense_id = definition.sense_id
					cross join public.${FixtureTable} profile
					where realm.kind = 'realm' and target.kind = 'target'
						and definition.ordinal < ${AcceptedApplicationsPerUnit}
						and profile.kind = 'profile' and profile.ordinal = 0
						and target.ordinal >= $1 and target.ordinal < $2
				`,
				[batchStart, batchEnd],
			);
			await client.query("commit");
		}
		await client.query("begin");
		await client.query("set local statement_timeout = 0");
		for (const relation of CapacityRelations) await client.query("analyze public." + relation);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		throw error;
	}
	const walEnd = await currentWalLsn(client);
	return {
		milliseconds: Number((performance.now() - startedAt).toFixed(3)),
		walBytes: await walBytesBetween(client, walStart, walEnd),
	};
}

async function validateReusableFixture(
	client: Client,
	input: { readonly pathCount: number; readonly profileCount: number; readonly unitCount: number },
): Promise<void> {
	for (const [kind, expected] of [
		["path", input.pathCount],
		["profile", input.profileCount],
		["target", input.unitCount],
	] as const) {
		const result = await client.query<{ readonly count: string }>(
			`select count(*)::text as count from public.${FixtureTable} where kind = $1`,
			[kind],
		);
		if (Number(requireRow(result.rows, "Reusable Tag Path capacity fixture").count) !== expected)
			throw new Error("Existing Tag Path capacity fixture does not match requested " + kind);
	}
	const expectedTagCount = input.pathCount + HotPathMemberCount;
	const projection = await client.query<{ readonly count: string }>(
		`select count(*)::text as count
		 from public.tag_public_position_stat projection
		 join public.${FixtureTable} fixture on fixture.id = projection.tag_id
		 where fixture.kind = 'tag'`,
	);
	if (
		Number(requireRow(projection.rows, "Reusable Tag projection fixture").count) !==
		expectedTagCount
	)
		throw new Error("Existing Tag Path capacity fixture has an incomplete position projection");
}

async function readFixtureIdentity(client: Client, profileCount: number): Promise<FixtureIdentity> {
	const result = await client.query<FixtureIdentity>(
		`
		select
			(select expression_id::text from public.${FixturePathTable} where ordinal = 0)
				as "hotExpressionId",
			md5('rezics-tag-path-capacity-v2:global-application:0:0')::uuid::text
				as "hotGlobalApplicationId",
			(select path_id::text from public.${FixturePathTable} where ordinal = 0) as "hotPathId",
			md5('rezics-tag-path-capacity-v2:realm-application:0:0')::uuid::text
				as "hotRealmApplicationId",
			(select id::text from public.${FixtureTable} where kind = 'target' and ordinal = 0)
				as "hotUnitId",
			(select array_agg(id::text order by ordinal) from public.${FixtureTable}
			 where kind = 'profile' and ordinal between 1 and $1::integer) as "profileIds",
			(select id::text from public.${FixtureTable} where kind = 'realm' and ordinal = 0)
				as "realmId",
			(select id::text from public.${FixtureTable} where kind = 'tag' and ordinal = 0)
				as "terminalTagId"
		`,
		[profileCount - 1],
	);
	const row = requireRow(result.rows, "Tag Path capacity fixture identities");
	if (
		!row.hotExpressionId ||
		!row.hotGlobalApplicationId ||
		!row.hotPathId ||
		!row.hotRealmApplicationId ||
		!row.hotUnitId ||
		!row.realmId ||
		!row.terminalTagId ||
		row.profileIds.length !== profileCount - 1
	)
		throw new Error("Tag Path capacity fixture identities are incomplete");
	return row;
}

function hotWriteSql(authority: ApplicationAuthority): string {
	const relation =
		authority === "global"
			? "unit_tag_path_application_judgment"
			: "realm_unit_tag_path_application_judgment";
	return `
		insert into public.${relation}(
			application_id, profile_id, fit_vote, spoiler_level,
			fit_updated_at, spoiler_updated_at, updated_at
		)
		values ($1::uuid, $2::uuid, 1, $3::smallint, now(), now(), now())
		on conflict (application_id, profile_id) do update set
			fit_vote = excluded.fit_vote,
			spoiler_level = excluded.spoiler_level,
			fit_updated_at = excluded.fit_updated_at,
			spoiler_updated_at = excluded.spoiler_updated_at,
			updated_at = excluded.updated_at
	`;
}

async function deterministicBackoff(sample: number, retry: number): Promise<void> {
	const cap = retry === 0 ? 25 : 50;
	const milliseconds = (sample * 17 + retry * 13) % (cap + 1);
	if (milliseconds > 0) await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function runHotWriteTier(input: {
	readonly authority: ApplicationAuthority;
	readonly concurrency: number;
	readonly connectionString: string;
	readonly fixture: FixtureIdentity;
	readonly poolCapacity: number;
	readonly sampleCount: number;
	readonly walClient: Client;
}): Promise<HotWriteSummary> {
	const clients = Array.from(
		{ length: input.concurrency },
		() => new Client({ connectionString: input.connectionString }),
	);
	await Promise.all(clients.map((client) => client.connect()));
	let nextSample = 0;
	let attempts = 0;
	let backpressure = 0;
	let commits = 0;
	let deadlocks = 0;
	let timeouts = 0;
	let unexpected = 0;
	const unexpectedErrors: string[] = [];
	const terminalLatencies: number[] = [];
	const backpressureDecisionLatencies: number[] = [];
	const sql = hotWriteSql(input.authority);
	const applicationId =
		input.authority === "global"
			? input.fixture.hotGlobalApplicationId
			: input.fixture.hotRealmApplicationId;
	const walStart = await currentWalLsn(input.walClient);
	const tierStartedAt = performance.now();
	try {
		await Promise.all(
			clients.map(async (client) => {
				while (nextSample < input.sampleCount) {
					const sample = nextSample;
					nextSample += 1;
					const profileId = input.fixture.profileIds[sample];
					if (!profileId) throw new Error("Hot-write Profile fixture is unavailable");
					const logicalStartedAt = performance.now();
					for (let retry = 0; retry <= HotKeyMaximumRetries; retry += 1) {
						attempts += 1;
						const attemptStartedAt = performance.now();
						try {
							await client.query("begin");
							await client.query("set local statement_timeout = '1500ms'");
							await client.query(sql, [applicationId, profileId, sample % 3]);
							await client.query("commit");
							commits += 1;
							terminalLatencies.push(performance.now() - logicalStartedAt);
							break;
						} catch (error) {
							await client.query("rollback").catch(() => undefined);
							if (hasPostgreSqlErrorCode(error, "55P03")) {
								backpressure += 1;
								backpressureDecisionLatencies.push(performance.now() - attemptStartedAt);
								if (retry < HotKeyMaximumRetries) {
									await deterministicBackoff(sample, retry);
									continue;
								}
								terminalLatencies.push(performance.now() - logicalStartedAt);
								break;
							}
							if (hasPostgreSqlErrorCode(error, "57014")) timeouts += 1;
							else if (hasPostgreSqlErrorCode(error, "40P01")) deadlocks += 1;
							else {
								unexpected += 1;
								if (unexpectedErrors.length < 5)
									unexpectedErrors.push(describeDatabaseError(error));
							}
							terminalLatencies.push(performance.now() - logicalStartedAt);
							break;
						}
					}
				}
			}),
		);
	} finally {
		await Promise.all(clients.map((client) => client.end()));
	}
	const elapsedMilliseconds = performance.now() - tierStartedAt;
	const walEnd = await currentWalLsn(input.walClient);
	return {
		authority: input.authority,
		attempts,
		backpressure,
		backpressureDecisionLatency: summarizeLatencies(backpressureDecisionLatencies),
		commits,
		deadlocks,
		elapsedMilliseconds: Number(elapsedMilliseconds.toFixed(3)),
		lockWaitP95Milliseconds: 0,
		poolUtilization: Number((input.concurrency / input.poolCapacity).toFixed(3)),
		terminalLatency: summarizeLatencies(terminalLatencies),
		throughputPerSecond: Number(((commits * 1_000) / elapsedMilliseconds).toFixed(3)),
		timeouts,
		unexpected,
		unexpectedErrors,
		walBytes: await walBytesBetween(input.walClient, walStart, walEnd),
	};
}

async function setPublicPositionVote(
	client: Client,
	pathOrdinal: number,
	value: -1 | 1,
): Promise<void> {
	const query = `
		update public.tag_path_vote vote
		set value = $2::smallint, updated_at = clock_timestamp()
		from public.${FixturePathTable} path, public.${FixtureTable} profile
		where path.ordinal = $1::integer
			and profile.kind = 'profile' and profile.ordinal = 0
			and vote.path_id = path.path_id and vote.profile_id = profile.id
	`;
	const result = await client.query(query, [pathOrdinal, value]);
	if (result.rowCount !== 1) throw new Error("Threshold crossing did not update one Path vote");
}

async function crossPublicPositionThreshold(client: Client, pathOrdinal: number): Promise<void> {
	await setPublicPositionVote(client, pathOrdinal, -1);
	await setPublicPositionVote(client, pathOrdinal, 1);
}

async function runPublicPositionTransitionTier(input: {
	readonly concurrency: number;
	readonly connectionString: string;
	readonly pathCount: number;
	readonly poolCapacity: number;
	readonly sampleCount: number;
	readonly walClient: Client;
}): Promise<HotWriteSummary> {
	const clients = Array.from(
		{ length: input.concurrency },
		() => new Client({ connectionString: input.connectionString }),
	);
	await Promise.all(clients.map((client) => client.connect()));
	let nextSample = 0;
	let attempts = 0;
	let backpressure = 0;
	let commits = 0;
	let deadlocks = 0;
	let timeouts = 0;
	let unexpected = 0;
	const unexpectedErrors: string[] = [];
	const terminalLatencies: number[] = [];
	const backpressureDecisionLatencies: number[] = [];
	const walStart = await currentWalLsn(input.walClient);
	const tierStartedAt = performance.now();
	try {
		await Promise.all(
			clients.map(async (client) => {
				while (nextSample < input.sampleCount) {
					const sample = nextSample;
					nextSample += 1;
					const logicalStartedAt = performance.now();
					for (let retry = 0; retry <= ProjectionHotKeyMaximumRetries; retry += 1) {
						attempts += 1;
						const attemptStartedAt = performance.now();
						try {
							await client.query("begin");
							await client.query("set local statement_timeout = '1500ms'");
							await crossPublicPositionThreshold(client, sample % input.pathCount);
							await client.query("commit");
							commits += 1;
							terminalLatencies.push(performance.now() - logicalStartedAt);
							break;
						} catch (error) {
							await client.query("rollback").catch(() => undefined);
							if (hasPostgreSqlErrorCode(error, "55P03")) {
								backpressure += 1;
								backpressureDecisionLatencies.push(performance.now() - attemptStartedAt);
								if (retry < ProjectionHotKeyMaximumRetries) {
									await deterministicBackoff(sample, retry);
									continue;
								}
								terminalLatencies.push(performance.now() - logicalStartedAt);
								break;
							}
							if (hasPostgreSqlErrorCode(error, "57014")) timeouts += 1;
							else if (hasPostgreSqlErrorCode(error, "40P01")) deadlocks += 1;
							else {
								unexpected += 1;
								if (unexpectedErrors.length < 5)
									unexpectedErrors.push(describeDatabaseError(error));
							}
							terminalLatencies.push(performance.now() - logicalStartedAt);
							break;
						}
					}
				}
			}),
		);
	} finally {
		await Promise.all(clients.map((client) => client.end()));
	}
	const elapsedMilliseconds = performance.now() - tierStartedAt;
	const walEnd = await currentWalLsn(input.walClient);
	return {
		authority: "public-position",
		attempts,
		backpressure,
		backpressureDecisionLatency: summarizeLatencies(backpressureDecisionLatencies),
		commits,
		deadlocks,
		elapsedMilliseconds: Number(elapsedMilliseconds.toFixed(3)),
		lockWaitP95Milliseconds: 0,
		poolUtilization: Number((input.concurrency / input.poolCapacity).toFixed(3)),
		terminalLatency: summarizeLatencies(terminalLatencies),
		throughputPerSecond: Number(((commits * 1_000) / elapsedMilliseconds).toFixed(3)),
		timeouts,
		unexpected,
		unexpectedErrors,
		walBytes: await walBytesBetween(input.walClient, walStart, walEnd),
	};
}

type PublicPositionCountRow = Readonly<{
	readonly publicPositionCount: string;
	readonly tagId: string;
}>;

async function readHotPathProjection(
	client: Client,
	hotPathId: string,
): Promise<readonly PublicPositionCountRow[]> {
	const result = await client.query<PublicPositionCountRow>(
		`select projection.tag_id::text as "tagId",
			projection.public_position_count::text as "publicPositionCount"
		 from public.tag_path_member member
		 join public.tag concept on concept.id = member.node_id
		 join public.tag_public_position_stat projection on projection.tag_id = concept.id
		 where member.path_id = $1::uuid
		 order by projection.tag_id`,
		[hotPathId],
	);
	return result.rows;
}

function assertProjectionDelta(
	before: readonly PublicPositionCountRow[],
	after: readonly PublicPositionCountRow[],
	delta: bigint,
	context: string,
): void {
	if (after.length !== before.length) throw new Error(context + " changed the projection fan-out");
	for (let index = 0; index < before.length; index += 1) {
		const previous = before[index];
		const current = after[index];
		if (!previous || !current || previous.tagId !== current.tagId)
			throw new Error(context + " changed the ordered Tag identity set");
		if (BigInt(current.publicPositionCount) !== BigInt(previous.publicPositionCount) + delta)
			throw new Error(context + " produced an incorrect counter delta for " + previous.tagId);
	}
}

async function verifyPublicPositionSafety(
	client: Client,
	fixture: FixtureIdentity,
): Promise<Readonly<Record<string, boolean | number | string>>> {
	const baseline = await readHotPathProjection(client, fixture.hotPathId);
	if (baseline.length !== HotPathMemberCount)
		throw new Error(
			`Hot Path projection fan-out expected ${HotPathMemberCount}, got ${baseline.length}`,
		);

	await client.query("begin");
	try {
		const publicStateTransitions = [
			{
				name: "status",
				reject:
					"update public.unit set status = 'draft', updated_at = clock_timestamp() where id = $1",
				restore:
					"update public.unit set status = 'published', updated_at = clock_timestamp() where id = $1",
			},
			{
				name: "visibility",
				reject:
					"update public.unit set visibility = 'private', updated_at = clock_timestamp() where id = $1",
				restore:
					"update public.unit set visibility = 'public', updated_at = clock_timestamp() where id = $1",
			},
			{
				name: "moderation",
				reject:
					"update public.unit set moderation_status = 'pending', updated_at = clock_timestamp() where id = $1",
				restore:
					"update public.unit set moderation_status = 'approved', updated_at = clock_timestamp() where id = $1",
			},
			{
				name: "soft deletion",
				reject:
					"update public.unit set deleted_at = clock_timestamp(), updated_at = clock_timestamp() where id = $1",
				restore:
					"update public.unit set deleted_at = null, updated_at = clock_timestamp() where id = $1",
			},
		] as const;
		for (const transition of publicStateTransitions) {
			const rejected = await client.query(transition.reject, [fixture.hotPathId]);
			if (rejected.rowCount !== 1)
				throw new Error(`Hot Path ${transition.name} transition updated no Unit`);
			assertProjectionDelta(
				baseline,
				await readHotPathProjection(client, fixture.hotPathId),
				-1n,
				`Path ${transition.name} rejection`,
			);
			await client.query(transition.restore, [fixture.hotPathId]);
			assertProjectionDelta(
				baseline,
				await readHotPathProjection(client, fixture.hotPathId),
				0n,
				`Path ${transition.name} restoration`,
			);
		}
		await client.query("commit");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		throw error;
	}

	await client.query("begin");
	try {
		await setPublicPositionVote(client, 0, -1);
		assertProjectionDelta(
			baseline,
			await readHotPathProjection(client, fixture.hotPathId),
			-1n,
			"Vote acceptance rejection",
		);
		await setPublicPositionVote(client, 0, 1);
		assertProjectionDelta(
			baseline,
			await readHotPathProjection(client, fixture.hotPathId),
			0n,
			"Vote acceptance restoration",
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		throw error;
	}

	let negativeGuardCode = "";
	await client.query("begin");
	try {
		const path = await client.query<{ readonly pathId: string }>(
			`select path_id::text as "pathId" from public.${FixturePathTable} where ordinal = 1`,
		);
		const pathId = requireRow(path.rows, "Negative-guard Path").pathId;
		await client.query("select public.adjust_tag_public_position_stat($1::uuid, -1)", [pathId]);
		await client.query("select public.adjust_tag_public_position_stat($1::uuid, -1)", [pathId]);
		throw new Error("Tag public-position negative guard accepted an underflow");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		if (!hasPostgreSqlErrorCode(error, "23514")) throw error;
		negativeGuardCode = "23514";
	}
	const minimum = await client.query<{ readonly count: string }>(
		"select min(public_position_count)::text as count from public.tag_public_position_stat",
	);
	if (BigInt(requireRow(minimum.rows, "Projection minimum").count) < 0n)
		throw new Error("Tag public-position projection contains a negative counter");

	await client.query("begin");
	let compatibilityCount = "";
	let hasOtherPositions = false;
	let projectionCountType = "";
	let directMutationGuardCode = "";
	try {
		const wide = await client.query<{
			readonly compatibilityCount: string;
			readonly hasOtherPositions: boolean;
			readonly projectionCountType: string;
		}>(
			`select greatest(3000000000::bigint - 1, 0)::text as "compatibilityCount",
				3000000000::bigint > 1 as "hasOtherPositions",
				format_type(attribute.atttypid, attribute.atttypmod) as "projectionCountType"
			 from pg_catalog.pg_attribute attribute
			 where attribute.attrelid = 'public.tag_public_position_stat'::regclass
				and attribute.attname = 'public_position_count' and not attribute.attisdropped`,
		);
		const row = requireRow(wide.rows, "Three-billion position projection");
		compatibilityCount = row.compatibilityCount;
		hasOtherPositions = row.hasOtherPositions;
		projectionCountType = row.projectionCountType;
		await client.query("rollback");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		throw error;
	}
	if (compatibilityCount !== "2999999999" || !hasOtherPositions || projectionCountType !== "bigint")
		throw new Error("Tag public-position compatibility fields are not bigint-safe at 3B");

	await client.query("begin");
	try {
		await client.query(
			"update public.tag_public_position_stat set public_position_count = public_position_count where tag_id = $1",
			[fixture.terminalTagId],
		);
		throw new Error("Tag public-position projection accepted a direct mutation");
	} catch (error) {
		await client.query("rollback").catch(() => undefined);
		if (!hasPostgreSqlErrorCode(error, "23514")) throw error;
		directMutationGuardCode = "23514";
	}

	const drift = await client.query(
		`with expected as (
			select requested.tag_id,
				count(member.path_id) filter (
					where path_unit.id is not null and vote_stat.path_id is not null
				)::bigint as expected_count
			from unnest($1::uuid[]) as requested(tag_id)
			left join public.tag_path_member member on member.node_id = requested.tag_id
			left join public.unit path_unit on path_unit.id = member.path_id
				and path_unit.kind = 'tag_path'
				and public.tag_path_unit_is_public(
					path_unit.status,
					path_unit.visibility,
					path_unit.moderation_status,
					path_unit.deleted_at
				)
			left join public.tag_path_vote_stat vote_stat on vote_stat.path_id = member.path_id
				and vote_stat.score > 0 and vote_stat.vote_count > 0
			group by requested.tag_id
		)
		select expected.tag_id
		from expected
		left join public.tag_public_position_stat projection on projection.tag_id = expected.tag_id
		where projection.tag_id is null
			or projection.public_position_count is distinct from expected.expected_count`,
		[baseline.map(({ tagId }) => tagId)],
	);
	if (drift.rowCount !== 0)
		throw new Error("Tag public-position safety checks left projection drift");
	return {
		affectedCountersPerTransition: baseline.length,
		bigintCompatibilityCount: compatibilityCount,
		bigintHasOtherPositions: hasOtherPositions,
		directMutationGuardCode,
		negativeGuardCode,
		projectionCountType,
		negativeMinimum: requireRow(minimum.rows, "Projection minimum").count,
		moderationTransitionRestored: true,
		softDeletionTransitionRestored: true,
		statusTransitionRestored: true,
		visibilityTransitionRestored: true,
		voteAcceptanceTransitionRestored: true,
	};
}

async function explain(
	client: Client,
	query: string,
	parameters: readonly unknown[],
	options: { readonly qualifyCorpusIndexRoute: boolean },
): Promise<PostgreSqlExplainPlan> {
	if (options.qualifyCorpusIndexRoute) {
		await client.query("begin");
		try {
			// The disposable fixture is intentionally small. Disabling sequential
			// scans only for this transaction proves that a bounded index topology
			// exists without pretending the toy planner cost is a 500M-row cost.
			await client.query("set local enable_seqscan = off");
			const result = await client.query<{ readonly "QUERY PLAN": unknown }>(
				"explain (analyze, buffers, wal, format json) " + query,
				[...parameters],
			);
			await client.query("rollback");
			return decodePostgreSqlExplainPlan(
				requireRow(result.rows, "Tag Path capacity EXPLAIN")["QUERY PLAN"],
			);
		} catch (error) {
			await client.query("rollback").catch(() => undefined);
			throw error;
		}
	}
	const result = await client.query<{ readonly "QUERY PLAN": unknown }>(
		"explain (analyze, buffers, wal, format json) " + query,
		[...parameters],
	);
	return decodePostgreSqlExplainPlan(
		requireRow(result.rows, "Tag Path capacity EXPLAIN")["QUERY PLAN"],
	);
}

function planEvidence(plan: PostgreSqlExplainPlan, summary: PlanSummary): PlanEvidence {
	return {
		executionMilliseconds: plan[0]["Execution Time"],
		planningMilliseconds: plan[0]["Planning Time"],
		summary,
	};
}

async function boundedPlan(
	client: Client,
	input: {
		readonly corpusRelations: readonly string[];
		readonly name: string;
		readonly parameters: readonly unknown[];
		readonly query: string;
		readonly requiredIndexes: readonly string[];
		readonly requiredIndexAlternatives?: readonly (readonly string[])[];
		readonly maximumSortRows?: number;
	},
): Promise<PlanEvidence> {
	const plan = await explain(client, input.query, input.parameters, {
		qualifyCorpusIndexRoute: input.corpusRelations.length > 0,
	});
	return planEvidence(
		plan,
		assertBoundedPostgreSqlPlan({
			corpusRelations: input.corpusRelations,
			maximumSharedBlocks: 512,
			maximumSortRows: input.maximumSortRows ?? 50,
			name: input.name,
			plan,
			requiredIndexes: input.requiredIndexes,
			requiredIndexAlternatives: input.requiredIndexAlternatives,
		}),
	);
}

async function capturePlans(
	client: Client,
	fixture: FixtureIdentity,
): Promise<Readonly<Record<string, PlanEvidence>>> {
	const zeroUuid = "00000000-0000-0000-0000-000000000000";
	const zeroPosition = "";
	const projectionTags = await client.query<{ readonly id: string }>(
		`select id::text as id from public.${FixtureTable}
		 where kind = 'tag' order by ordinal limit 50`,
	);
	return {
		publicPositionProjection: await boundedPlan(client, {
			name: "Tag public-position request projection",
			query: `
				select tag_id, public_position_count
				from public.tag_public_position_stat
				where tag_id = any($1::uuid[])
			`,
			parameters: [projectionTags.rows.map(({ id }) => id)],
			requiredIndexes: ["tag_public_position_stat_pkey"],
			corpusRelations: ["tag_public_position_stat"],
		}),
		pathsContainingTag: await boundedPlan(client, {
			name: "accepted Paths containing a Tag",
			query: `
				with candidate_path as materialized (
					select member.path_id
					from public.tag_path_member member
					where member.node_id = $1::uuid and member.path_id > $2::uuid
					order by member.path_id
					limit 65
				)
				select candidate.path_id, stat.score, stat.vote_count, stat.usage_count
				from candidate_path candidate
				join public.tag_path_vote_stat stat on stat.path_id = candidate.path_id
				order by candidate.path_id
			`,
			parameters: [fixture.terminalTagId, zeroUuid],
			maximumSortRows: 65,
			requiredIndexes: [],
			requiredIndexAlternatives: [["tag_path_member_node_path_idx", "tag_path_member_pkey"]],
			corpusRelations: ["tag_path_member", "tag_path_vote_stat"],
		}),
		unitApplications: await boundedPlan(client, {
			name: "Unit Application keyset page",
			query: `
				select id, sense_id, pinned, position
				from public.unit_tag_path_application
				where unit_id = $1::uuid
					and (pinned, position, id) > (false, $2::text, $3::uuid)
				order by pinned, position, id
				limit 50
			`,
			parameters: [fixture.hotUnitId, zeroPosition, zeroUuid],
			requiredIndexes: ["unit_tag_path_application_unit_position_idx"],
			corpusRelations: ["unit_tag_path_application"],
		}),
		expressionAssertions: await boundedPlan(client, {
			name: "Expression assertion inverse page",
			query: `
				select unit_id, direct, path_application_count
				from public.unit_expression_assertion
				where expression_id = $1::uuid and unit_id > $2::uuid
				order by unit_id limit 50
			`,
			parameters: [fixture.hotExpressionId, zeroUuid],
			requiredIndexes: ["unit_expression_assertion_expression_idx"],
			corpusRelations: ["unit_expression_assertion"],
		}),
		effectiveTagInverse: await boundedPlan(client, {
			name: "Effective Tag inverse page",
			query: `
				select unit_id, direct, primary_expression_count,
					entailed_expression_count, retrieval_expression_count
				from public.unit_effective_tag
				where tag_id = $1::uuid and unit_id > $2::uuid
				order by unit_id limit 50
			`,
			parameters: [fixture.terminalTagId, zeroUuid],
			requiredIndexes: ["unit_effective_tag_tag_idx"],
			corpusRelations: ["unit_effective_tag"],
		}),
		realmApplications: await boundedPlan(client, {
			name: "Realm Unit Application page",
			query: `
				select id, sense_id
				from public.realm_unit_tag_path_application
				where unit_id = $1::uuid and realm_id = $2::uuid
					and (sense_id, id) > ($3::uuid, $3::uuid)
				order by sense_id, id limit 50
			`,
			parameters: [fixture.hotUnitId, fixture.realmId, zeroUuid],
			maximumSortRows: 51,
			requiredIndexes: [],
			requiredIndexAlternatives: [
				[
					"realm_unit_tag_path_application_unit_route_idx",
					"realm_unit_tag_path_application_authority_key",
				],
			],
			corpusRelations: ["realm_unit_tag_path_application"],
		}),
		activeSenses: await boundedPlan(client, {
			name: "active Path Sense page",
			query: `
				select id, expression_id
				from public.tag_path_sense
				where path_id = $1::uuid and status = 'active' and id > $2::uuid
				order by id limit 50
			`,
			parameters: [fixture.hotPathId, zeroUuid],
			requiredIndexes: ["tag_path_sense_path_route_idx"],
			corpusRelations: ["tag_path_sense"],
		}),
		activeInferenceRules: await boundedPlan(client, {
			name: "active inference-rule page",
			query: `
				select id, target_tag_id, target_expression_id, inference_kind
				from public.tag_expression_inference_rule
				where source_expression_id = $1::uuid and status = 'active'
					and id > $2::uuid
				order by id limit 50
			`,
			parameters: [fixture.hotExpressionId, zeroUuid],
			requiredIndexes: ["tag_expression_inference_rule_source_idx"],
			corpusRelations: ["tag_expression_inference_rule"],
		}),
		hotJudgmentMutation: await boundedPlan(client, {
			name: "hot Application judgment mutation",
			query: hotWriteSql("global"),
			parameters: [fixture.hotGlobalApplicationId, fixture.profileIds[0], 0],
			requiredIndexes: [],
			corpusRelations: [
				"unit_tag_path_application_judgment",
				"unit_tag_path_application_judgment_stat",
			],
		}),
	};
}

async function verifyParity(
	client: Client,
	fixture: FixtureIdentity,
	input: { readonly pathCount: number; readonly unitCount: number },
): Promise<Readonly<Record<string, boolean | number>>> {
	const result = await client.query<{
		readonly bareRedDirectCount: string;
		readonly expressionEffectiveTagCount: string;
		readonly globalApplicationCount: string;
		readonly globalAssertionCount: string;
		readonly globalEffectiveTagCount: string;
		readonly hotIntermediateLeakCount: string;
		readonly pathMemberCount: string;
		readonly projectionNegativeCount: string;
		readonly projectionTagCount: string;
		readonly qualifiedAssertionCount: string;
		readonly realmApplicationCount: string;
		readonly realmAssertionCount: string;
		readonly realmEffectiveTagCount: string;
		readonly terminalPublicPositionCount: string;
	}>(
		`
		select
			(select count(*)::text from public.unit_tag
			 where unit_id = $1::uuid and tag_id = $2::uuid) as "bareRedDirectCount",
			(select count(*)::text from public.tag_expression_effective_tag)
				as "expressionEffectiveTagCount",
			(select count(*)::text from public.unit_tag_path_application) as "globalApplicationCount",
			(select count(*)::text from public.unit_expression_assertion) as "globalAssertionCount",
			(select count(*)::text from public.unit_effective_tag) as "globalEffectiveTagCount",
			(select count(*)::text
			 from public.unit_effective_tag effective
			 join public.${FixtureTable} tag on tag.id = effective.tag_id and tag.kind = 'tag'
			 where effective.unit_id = $1::uuid and tag.ordinal between 2 and 15)
				as "hotIntermediateLeakCount",
			(select count(*)::text from public.tag_path_member) as "pathMemberCount",
			(select count(*)::text from public.tag_public_position_stat
			 where public_position_count < 0) as "projectionNegativeCount",
			(select count(*)::text from public.tag_public_position_stat projection
			 join public.${FixtureTable} fixture on fixture.id = projection.tag_id
			 where fixture.kind = 'tag') as "projectionTagCount",
			(select count(*)::text from public.unit_expression_assertion
			 where unit_id = $1::uuid and expression_id = $3::uuid
				and direct = false and path_application_count = 1) as "qualifiedAssertionCount",
			(select count(*)::text from public.realm_unit_tag_path_application)
				as "realmApplicationCount",
			(select count(*)::text from public.realm_unit_expression_assertion)
				as "realmAssertionCount",
			(select count(*)::text from public.realm_unit_effective_tag)
				as "realmEffectiveTagCount",
			(select public_position_count::text from public.tag_public_position_stat
			 where tag_id = $2::uuid) as "terminalPublicPositionCount"
	`,
		[fixture.hotUnitId, fixture.terminalTagId, fixture.hotExpressionId],
	);
	const row = requireRow(result.rows, "Tag Path semantic parity");
	const applicationCount = input.pathCount + (input.unitCount - 1) * AcceptedApplicationsPerUnit;
	const assertionCount = input.unitCount * AcceptedApplicationsPerUnit;
	const effectiveTagCount = input.unitCount * (AcceptedApplicationsPerUnit + 1);
	const pathMemberCount = input.pathCount * 2 + (HotPathMemberCount - 2);
	const expressionEffectiveTagCount = input.pathCount * 2;
	const projectionTagCount = input.pathCount + HotPathMemberCount;
	const actual = {
		bareRedDirectCount: Number(row.bareRedDirectCount),
		expressionEffectiveTagCount: Number(row.expressionEffectiveTagCount),
		globalApplicationCount: Number(row.globalApplicationCount),
		globalAssertionCount: Number(row.globalAssertionCount),
		globalEffectiveTagCount: Number(row.globalEffectiveTagCount),
		hotIntermediateLeakCount: Number(row.hotIntermediateLeakCount),
		pathMemberCount: Number(row.pathMemberCount),
		projectionNegativeCount: Number(row.projectionNegativeCount),
		projectionTagCount: Number(row.projectionTagCount),
		qualifiedAssertionCount: Number(row.qualifiedAssertionCount),
		realmApplicationCount: Number(row.realmApplicationCount),
		realmAssertionCount: Number(row.realmAssertionCount),
		realmEffectiveTagCount: Number(row.realmEffectiveTagCount),
		terminalPublicPositionCount: Number(row.terminalPublicPositionCount),
	};
	for (const [name, value, expected] of [
		["bare Red direct assertion", actual.bareRedDirectCount, 0],
		["definition Effective Tags", actual.expressionEffectiveTagCount, expressionEffectiveTagCount],
		["global Applications", actual.globalApplicationCount, applicationCount],
		["global Expression assertions", actual.globalAssertionCount, assertionCount],
		["global Effective Tags", actual.globalEffectiveTagCount, effectiveTagCount],
		["Path-driven intermediate support", actual.hotIntermediateLeakCount, 0],
		["Path members", actual.pathMemberCount, pathMemberCount],
		["negative Tag position projections", actual.projectionNegativeCount, 0],
		["Tag position projections", actual.projectionTagCount, projectionTagCount],
		["qualified Expression assertion", actual.qualifiedAssertionCount, 1],
		["Realm Applications", actual.realmApplicationCount, applicationCount],
		["Realm Expression assertions", actual.realmAssertionCount, assertionCount],
		["Realm Effective Tags", actual.realmEffectiveTagCount, effectiveTagCount],
		["hot terminal public positions", actual.terminalPublicPositionCount, input.pathCount],
	] as const)
		if (value !== expected)
			throw new Error(`${name} parity failed: expected ${expected}, received ${value}`);
	return {
		...actual,
		applicationCountExpected: applicationCount,
		assertionCountExpected: assertionCount,
		bareRedAndQualifiedClaimRemainDistinct: true,
		effectiveTagCountExpected: effectiveTagCount,
		terminalHasOtherPositions: actual.terminalPublicPositionCount > 1,
		terminalOtherPositionCount: actual.terminalPublicPositionCount - 1,
		pathLengthDoesNotCreateAssertions: true,
	};
}

async function relationStorage(client: Client): Promise<readonly RelationStorage[]> {
	const storage: RelationStorage[] = [];
	for (const relation of CapacityRelations) {
		const result = await client.query<{
			readonly indexBytes: string;
			readonly rowCount: string;
			readonly totalBytes: string;
		}>(
			`
			select pg_indexes_size($1::regclass)::text as "indexBytes",
				count(*)::text as "rowCount",
				pg_total_relation_size($1::regclass)::text as "totalBytes"
			from public.${relation}
		`,
			[`public.${relation}`],
		);
		const row = requireRow(result.rows, "Tag Path relation storage");
		const rowCount = Number(row.rowCount);
		const totalBytes = Number(row.totalBytes);
		const totalBytesPerRow = rowCount > 0 ? totalBytes / rowCount : 0;
		storage.push({
			estimated500MillionBytes: Math.ceil(totalBytesPerRow * 500_000_000),
			estimated3BillionBytes: Math.ceil(totalBytesPerRow * 3_000_000_000),
			indexBytes: Number(row.indexBytes),
			relation,
			rowCount,
			totalBytes,
			totalBytesPerRow: Number(totalBytesPerRow.toFixed(3)),
		});
	}
	return storage;
}

function assertAcceptedWorkload(summary: HotWriteSummary): void {
	const evidence = JSON.stringify(summary);
	if (summary.unexpected || summary.deadlocks || summary.timeouts)
		throw new Error(
			summary.authority + " hot-write tier had unexpected terminal outcomes: " + evidence,
		);
	if (summary.commits < Math.floor(summary.terminalLatency.count * 0.8))
		throw new Error(
			summary.authority + " hot-write tier committed fewer than 80% of samples: " + evidence,
		);
	if (summary.throughputPerSecond < 100)
		throw new Error(
			summary.authority +
				" hot-write throughput was " +
				summary.throughputPerSecond +
				" commits/s; minimum is 100: " +
				evidence,
		);
	if (summary.terminalLatency.p95Milliseconds >= 150)
		throw new Error(
			summary.authority +
				" terminal mutation p95 was " +
				summary.terminalLatency.p95Milliseconds +
				" ms; maximum is below 150 ms: " +
				evidence,
		);
	if (summary.poolUtilization >= 0.8)
		throw new Error(
			summary.authority + " benchmark pool utilization was not below 80%: " + evidence,
		);
}

const unitCount = requireMinimum(
	"--units",
	readPositiveIntegerFlag(process.argv, "--units", 1_000, 100_000),
	1_000,
);
const pathCount = requireMinimum(
	"--paths",
	readPositiveIntegerFlag(process.argv, "--paths", 1_000, 100_000),
	100,
);
const sampleCount = readPositiveIntegerFlag(process.argv, "--samples", 256, 4_096);
const concurrency = readPositiveIntegerFlag(process.argv, "--concurrency", 6, 128);
const poolCapacity = readPositiveIntegerFlag(process.argv, "--pool-capacity", 64, 512);
if (concurrency >= poolCapacity * 0.8)
	throw new RangeError("--concurrency must remain below 80% of --pool-capacity");
const connectionString = requireDisposableTagPathDatabase({
	confirmation: process.argv.includes("--yes"),
	connectionString: process.env.DATABASE_ADMIN_URL,
	marker: process.env.TAG_PATH_CAPACITY_DISPOSABLE,
});
const reuseFixture = process.argv.includes("--reuse");
const profileCount = sampleCount + 1;
const client = new Client({ connectionString });
await client.connect();
try {
	await client.query("set statement_timeout = 0");
	const load = reuseFixture
		? (await validateReusableFixture(client, { pathCount, profileCount, unitCount }),
			{ milliseconds: null, walBytes: null })
		: await loadFixture(client, { pathCount, profileCount, unitCount });
	const fixture = await readFixtureIdentity(client, profileCount);
	const globalWrites = await runHotWriteTier({
		authority: "global",
		concurrency,
		connectionString,
		fixture,
		poolCapacity,
		sampleCount,
		walClient: client,
	});
	const realmWrites = await runHotWriteTier({
		authority: "realm",
		concurrency,
		connectionString,
		fixture,
		poolCapacity,
		sampleCount,
		walClient: client,
	});
	const publicPositionSafety = await verifyPublicPositionSafety(client, fixture);
	const publicPositionWrites = await runPublicPositionTransitionTier({
		concurrency,
		connectionString,
		pathCount,
		poolCapacity,
		sampleCount,
		walClient: client,
	});
	assertAcceptedWorkload(globalWrites);
	assertAcceptedWorkload(realmWrites);
	assertAcceptedWorkload(publicPositionWrites);
	for (const relation of CapacityRelations) await client.query("analyze public." + relation);
	const plans = await capturePlans(client, fixture);
	const parity = await verifyParity(client, fixture, { pathCount, unitCount });
	const storage = await relationStorage(client);
	const runtime = await client.query<{
		readonly databaseBytes: string;
		readonly serverVersion: string;
		readonly sharedBuffers: string;
		readonly workMem: string;
	}>(`select
		pg_database_size(current_database())::text as "databaseBytes",
		current_setting('server_version') as "serverVersion",
		current_setting('shared_buffers') as "sharedBuffers",
		current_setting('work_mem') as "workMem"`);
	const runtimeRow = requireRow(runtime.rows, "Tag Path capacity runtime");
	console.info(
		JSON.stringify(
			{
				schemaVersion: 3,
				fixture: {
					acceptedApplicationsPerUnit: AcceptedApplicationsPerUnit,
					hotPathMemberCount: HotPathMemberCount,
					pathCount,
					profileCount,
					reused: reuseFixture,
					unitCount,
				},
				load,
				workloads: {
					global: globalWrites,
					publicPosition: publicPositionWrites,
					realm: realmWrites,
				},
				plans,
				parity,
				publicPositionSafety,
				storage,
				runtime: {
					databaseBytes: Number(runtimeRow.databaseBytes),
					serverVersion: runtimeRow.serverVersion,
					sharedBuffers: runtimeRow.sharedBuffers,
					workMem: runtimeRow.workMem,
				},
				qualification: {
					cardinalityEvidence:
						"Fixture proves bounded routing and measures bytes/row; 500M/3B values are straight-line topology estimates, not toy-fixture latency extrapolations.",
					corpusPlanMode:
						"Corpus EXPLAIN transactions set enable_seqscan=off to prove index-routable topology on the deliberately small fixture; production planner settings remain unchanged.",
					fanOut:
						"The fixture includes a 16-member Path whose accepted source yields one Expression assertion plus only explicit Effective Tags.",
					lockStrategy:
						"pg_try_advisory_xact_lock returns immediate retryable backpressure, so aggregate lock wait is structurally zero.",
					publicPositionRequestBound:
						"Search reads at most 50 tag_public_position_stat primary keys; Path state and accepted-vote threshold crossings update at most 16 concept counters.",
					projectionSkew:
						"Every fixture Path shares one terminal Tag, so the public-position tier measures the intentional hot-key backpressure path under concurrent threshold crossings.",
					passed: true,
				},
			},
			null,
			2,
		),
	);
} finally {
	await client.end();
}
