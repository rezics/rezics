import { Client } from "pg";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const UnitId = "73600000-0000-7000-8000-000000000001";
const AuditEventId = "73600000-0000-7000-8000-000000000002";
const Timestamp = "2026-08-11T19:00:00.000Z";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

async function assertDisposableDatabase(client: Client): Promise<void> {
	assert(
		process.env[FixtureFlag] === "1",
		`${FixtureFlag}=1 is required because this check writes disposable fixtures`,
	);
	const result = await client.query<{ readonly database: string }>(
		"select current_database() as database",
	);
	assert(
		result.rows[0]?.database === "rezics_atlas",
		"Governance cutover fixtures may run only in the disposable rezics_atlas database",
	);
}

async function columnExists(client: Client, relation: string, column: string): Promise<boolean> {
	const result = await client.query<{ readonly exists: boolean }>(
		`select exists (
			select 1
			from pg_catalog.pg_attribute
			where attrelid = $1::regclass
				and attname = $2
				and attnum > 0
				and not attisdropped
		) as exists`,
		[relation, column],
	);
	return result.rows[0]?.exists === true;
}

async function seed(client: Client): Promise<void> {
	assert(
		!(await columnExists(client, "public.audit_event", "governance_decision_id")),
		"Governance cutover seed requires the pre-1.7 schema",
	);
	await client.query("begin");
	try {
		await client.query(
			`insert into public.unit (id, kind, created_at, updated_at)
			values ($1, 'entity', $2, $2)`,
			[UnitId, Timestamp],
		);
		await client.query(
			`insert into public.audit_event (
				id, schema_version, category, outcome, actor_kind,
				actor_credential_kind, authority_kind, action, reason_code,
				target_kind, target_id, created_at
			) values (
				$1, 1, 'system_event', 'succeeded', 'system',
				'system', 'platform', 'fixture.pre_1_7', 'obsolete_fixture_reason',
				'unit', $2, $3
			)`,
			[AuditEventId, UnitId, Timestamp],
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
	console.info("Seeded a non-empty pre-1.7 governance cutover fixture.");
}

async function verifyAndClean(client: Client): Promise<void> {
	assert(
		await columnExists(client, "public.audit_event", "governance_decision_id"),
		"Governance cutover verification requires the post-1.7 schema",
	);
	assert(
		!(await columnExists(client, "public.audit_event", "reason_code")),
		"The obsolete audit reason column still exists",
	);
	const result = await client.query<{
		readonly schemaVersion: number;
		readonly outcomeCode: string | null;
		readonly governanceDecisionId: string | null;
	}>(
		`select
			a.schema_version as "schemaVersion",
			a.outcome_code as "outcomeCode",
			a.governance_decision_id as "governanceDecisionId"
		from public.audit_event a
		inner join public.unit u on u.id = a.target_id
		where a.id = $1 and u.id = $2`,
		[AuditEventId, UnitId],
	);
	assert(result.rows.length === 1, "The non-empty upgrade did not preserve its fixture rows");
	assert(result.rows[0]?.schemaVersion === 1, "Historical audit schema version was rewritten");
	assert(result.rows[0]?.outcomeCode === null, "A machine outcome was fabricated during upgrade");
	assert(
		result.rows[0]?.governanceDecisionId === null,
		"A governance decision was fabricated from the obsolete reason",
	);

	const nullableDecisionColumns = await client.query<{
		readonly relation: string;
		readonly nullable: boolean;
	}>(
		`select
			c.relname as relation,
			not a.attnotnull as nullable
		from pg_catalog.pg_attribute a
		inner join pg_catalog.pg_class c on c.oid = a.attrelid
		inner join pg_catalog.pg_namespace n on n.oid = c.relnamespace
		where n.nspname = 'public'
			and a.attname = 'decision_id'
			and c.relname = any($1::text[])
			and a.attnum > 0
			and not a.attisdropped`,
		[
			[
				"user_account_state",
				"account_enforcement_action",
				"content_governance_action",
				"unit_access_restriction",
				"unit_merge_request",
			],
		],
	);
	assert(nullableDecisionColumns.rows.length === 5, "A cutover decision column is missing");
	assert(
		nullableDecisionColumns.rows.every(({ nullable }) => nullable),
		"Pre-cutover domain rows must permit an absent governance decision",
	);
	const insertGuards = await client.query<{ readonly count: number }>(
		`select count(*)::integer as count
		from pg_catalog.pg_trigger
		where not tgisinternal
			and tgname = any($1::text[])`,
		[
			[
				"user_account_state_decision_required",
				"account_enforcement_action_decision_required",
				"content_governance_action_decision_required",
				"unit_access_restriction_decision_required",
				"unit_merge_request_decision_required",
			],
		],
	);
	assert(insertGuards.rows[0]?.count === 5, "Post-cutover decision insert guards are missing");

	await client.query("begin");
	try {
		await client.query("alter table public.audit_event disable trigger audit_event_append_only");
		await client.query("delete from public.audit_event where id = $1", [AuditEventId]);
		await client.query("alter table public.audit_event enable trigger audit_event_append_only");
		await client.query("delete from public.unit where id = $1", [UnitId]);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
	console.info("Verified and removed the non-empty governance cutover fixture.");
}

const mode = process.argv[2];
assert(
	mode === "seed" || mode === "verify-and-clean",
	"Usage: check-governance-rule-cutover.ts <seed|verify-and-clean>",
);
const connectionString = process.env.DATABASE_ADMIN_URL;
assert(connectionString, "DATABASE_ADMIN_URL is required");
const client = new Client({ connectionString });

try {
	await client.connect();
	await assertDisposableDatabase(client);
	if (mode === "seed") await seed(client);
	else await verifyAndClean(client);
} finally {
	await client.end();
}
