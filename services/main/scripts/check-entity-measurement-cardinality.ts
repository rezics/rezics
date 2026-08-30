import { Client } from "pg";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const Timestamp = "2026-08-29T13:51:59.000Z";
const SequentialEntityId = "74600000-0000-7000-8000-000000000001";
const ConcurrentEntityId = "74600000-0000-7000-8000-000000000002";
const ContextUnitIds = Array.from(
	{ length: 18 },
	(_, index) => `74700000-0000-7000-8000-${String(index + 1).padStart(12, "0")}`,
);
const EntityIds = [SequentialEntityId, ConcurrentEntityId] as const;

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function databaseErrorField(error: unknown, field: "code" | "constraint"): string | undefined {
	return isRecord(error) && typeof error[field] === "string" ? error[field] : undefined;
}

function assertDatabaseError(
	error: unknown,
	expected: { readonly code: string; readonly constraint: string },
	message: string,
): void {
	const code = databaseErrorField(error, "code");
	const constraint = databaseErrorField(error, "constraint");
	assert(
		code === expected.code,
		`${message}; expected PostgreSQL ${expected.code}, received ${code}`,
	);
	assert(
		constraint === expected.constraint,
		`${message}; expected constraint ${expected.constraint}, received ${constraint}`,
	);
}

async function expectDatabaseError(
	operation: () => Promise<unknown>,
	expected: { readonly code: string; readonly constraint: string },
	message: string,
): Promise<void> {
	try {
		await operation();
	} catch (error) {
		assertDatabaseError(error, expected, message);
		return;
	}
	throw new Error(`${message}; operation unexpectedly succeeded`);
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
		"Entity measurement fixtures may run only in the disposable rezics_atlas database",
	);
}

async function cleanupFixture(client: Client): Promise<void> {
	await client.query("delete from public.unit where id = any($1::uuid[])", [EntityIds]);
	await client.query("delete from public.unit where id = any($1::uuid[])", [ContextUnitIds]);
}

async function seedFixtureOwners(client: Client): Promise<void> {
	await client.query(
		`insert into public.unit (id, kind, created_at, updated_at)
		select id::uuid, 'entity', $2::timestamptz, $2::timestamptz
		from unnest($1::text[]) as fixture(id)`,
		[EntityIds, Timestamp],
	);
	await client.query(
		`insert into public.entity (id, kind, created_at, updated_at)
		select id::uuid, 'person', $2::timestamptz, $2::timestamptz
		from unnest($1::text[]) as fixture(id)`,
		[EntityIds, Timestamp],
	);
	await client.query(
		`insert into public.unit (id, kind, created_at, updated_at)
		select id::uuid, 'software', $2::timestamptz, $2::timestamptz
		from unnest($1::text[]) as fixture(id)`,
		[ContextUnitIds, Timestamp],
	);
}

async function insertContextualRows(
	client: Client,
	entityId: string,
	contextUnitIds: readonly string[],
): Promise<void> {
	await client.query(
		`insert into public.entity_measurement (
			entity_id, context_unit_id, height_millimetres, created_at, updated_at
		)
		select $1::uuid, context_id::uuid, 1700, $3::timestamptz, $3::timestamptz
		from unnest($2::text[]) as contexts(context_id)`,
		[entityId, contextUnitIds, Timestamp],
	);
}

async function verifyTriggerInstallation(client: Client): Promise<void> {
	const result = await client.query<{ readonly definition: string; readonly function: string }>(
		`select
			pg_get_triggerdef(trigger.oid, true) as definition,
			pg_get_functiondef(procedure.oid) as function
		from pg_catalog.pg_trigger as trigger
		join pg_catalog.pg_proc as procedure on procedure.oid = trigger.tgfoid
		where trigger.tgrelid = 'public.entity_measurement'::regclass
			and trigger.tgname = 'entity_measurement_guard'
			and not trigger.tgisinternal`,
	);
	const row = result.rows[0];
	assert(row, "The Entity measurement guard trigger is missing");
	assert(
		row.definition.includes("BEFORE INSERT OR DELETE OR UPDATE"),
		"The Entity measurement guard must cover inserts, deletes, and updates",
	);
	assert(
		row.function.includes("pg_advisory_xact_lock") && row.function.includes("OFFSET 7"),
		"The contextual limit must use its Entity-scoped lock and eight-row indexed probe",
	);
}

async function verifySequentialBoundary(client: Client): Promise<void> {
	await client.query(
		`insert into public.entity_measurement (
			entity_id, context_unit_id, weight_grams, created_at, updated_at
		) values ($1, null, 65000, $2, $2)`,
		[SequentialEntityId, Timestamp],
	);
	await insertContextualRows(client, SequentialEntityId, ContextUnitIds.slice(0, 8));

	const count = await client.query<{
		readonly contextual: number;
		readonly total: number;
	}>(
		`select
			count(*) filter (where context_unit_id is not null)::integer as contextual,
			count(*)::integer as total
		from public.entity_measurement
		where entity_id = $1`,
		[SequentialEntityId],
	);
	assert(
		count.rows[0]?.contextual === 8 && count.rows[0]?.total === 9,
		"One canonical and eight contextual Entity measurement rows must succeed",
	);

	await expectDatabaseError(
		() => insertContextualRows(client, SequentialEntityId, [ContextUnitIds[8]!]),
		{ code: "23514", constraint: "entity_measurement_context_limit" },
		"A ninth contextual Entity measurement row must fail",
	);
	await expectDatabaseError(
		() =>
			client.query(
				`update public.entity_measurement
				set context_unit_id = $3
				where entity_id = $1 and context_unit_id = $2`,
				[SequentialEntityId, ContextUnitIds[0], ContextUnitIds[8]],
			),
		{ code: "23514", constraint: "entity_measurement_identity_immutable" },
		"Entity measurement identity must remain immutable",
	);
	await client.query(
		`update public.entity_measurement
		set height_millimetres = 1701, updated_at = $3
		where entity_id = $1 and context_unit_id = $2`,
		[SequentialEntityId, ContextUnitIds[0], Timestamp],
	);
}

async function waitForAdvisoryLockWait(observer: Client, processId: number): Promise<void> {
	const deadline = Date.now() + 5_000;
	while (Date.now() < deadline) {
		const result = await observer.query<{ readonly waiting: boolean }>(
			`select exists (
				select 1
				from pg_catalog.pg_locks
				where pid = $1 and locktype = 'advisory' and not granted
			) as waiting`,
			[processId],
		);
		if (result.rows[0]?.waiting) return;
		await new Promise<void>((resolve) => setTimeout(resolve, 10));
	}
	throw new Error("The competing Entity measurement insert did not wait on the advisory lock");
}

async function verifyConcurrentBoundary(observer: Client, connectionString: string): Promise<void> {
	await insertContextualRows(observer, ConcurrentEntityId, ContextUnitIds.slice(9, 16));

	const first = new Client({
		connectionString,
		application_name: "entity-measurement-cardinality-first",
	});
	const second = new Client({
		connectionString,
		application_name: "entity-measurement-cardinality-second",
	});
	await Promise.all([first.connect(), second.connect()]);
	const process = await second.query<{ readonly processId: number }>(
		`select pg_backend_pid()::integer as "processId"`,
	);
	const secondProcessId = process.rows[0]?.processId;
	assert(typeof secondProcessId === "number", "The competing PostgreSQL process ID is unavailable");

	let firstOpen = false;
	let secondOpen = false;
	let secondOutcome: Promise<{ readonly error: unknown | null }> | undefined;
	try {
		await first.query("begin");
		firstOpen = true;
		await second.query("begin");
		secondOpen = true;
		await second.query("set local lock_timeout = '10s'");

		await insertContextualRows(first, ConcurrentEntityId, [ContextUnitIds[16]!]);
		secondOutcome = insertContextualRows(second, ConcurrentEntityId, [ContextUnitIds[17]!]).then(
			() => ({ error: null }),
			(error: unknown) => ({ error }),
		);
		await waitForAdvisoryLockWait(observer, secondProcessId);

		await first.query("commit");
		firstOpen = false;
		const outcome = await secondOutcome;
		assert(outcome.error !== null, "Both concurrent contextual inserts unexpectedly succeeded");
		assertDatabaseError(
			outcome.error,
			{ code: "23514", constraint: "entity_measurement_context_limit" },
			"The serialized ninth contextual insert must fail",
		);
		await second.query("rollback");
		secondOpen = false;
	} finally {
		if (firstOpen) await first.query("rollback");
		if (secondOutcome) await secondOutcome;
		if (secondOpen) await second.query("rollback");
		await Promise.all([first.end(), second.end()]);
	}

	const count = await observer.query<{ readonly contextual: number }>(
		`select count(*)::integer as contextual
		from public.entity_measurement
		where entity_id = $1 and context_unit_id is not null`,
		[ConcurrentEntityId],
	);
	assert(
		count.rows[0]?.contextual === 8,
		"Concurrent inserts must leave exactly eight contextual measurement rows",
	);
}

async function verifyBoundedMergePlan(client: Client): Promise<void> {
	const exact = await client.query<{ readonly contextualCount: number }>(
		`select count(*)::integer as "contextualCount"
		from (
			select case
				when context_unit_id = $1::uuid then $2::uuid
				else context_unit_id
			end as destination_context_unit_id
			from public.entity_measurement
			where entity_id = any($3::uuid[]) and context_unit_id is not null
			group by destination_context_unit_id
		) as contextual_destinations`,
		[SequentialEntityId, ConcurrentEntityId, EntityIds],
	);
	assert(
		exact.rows[0]?.contextualCount === 16,
		"The exact two-Entity contextual count must preserve all sixteen destinations",
	);

	await client.query("set enable_seqscan = off");
	try {
		const plan = await client.query(
			`explain (format json)
			select count(*)::integer
			from (
				select case
					when context_unit_id = $1::uuid then $2::uuid
					else context_unit_id
				end as destination_context_unit_id
				from public.entity_measurement
				where entity_id = any($3::uuid[]) and context_unit_id is not null
				group by destination_context_unit_id
			) as contextual_destinations`,
			[SequentialEntityId, ConcurrentEntityId, EntityIds],
		);
		assert(
			JSON.stringify(plan.rows).includes("entity_measurement_entity_context_key"),
			"The exact two-Entity contextual count must remain eligible for its leading Entity index",
		);
	} finally {
		await client.query("reset enable_seqscan");
	}
}

const connectionString = process.env.DATABASE_ADMIN_URL;
assert(connectionString, "DATABASE_ADMIN_URL is required");
const client = new Client({ connectionString });

try {
	await client.connect();
	await assertDisposableDatabase(client);
	await cleanupFixture(client);
	try {
		await verifyTriggerInstallation(client);
		await seedFixtureOwners(client);
		await verifySequentialBoundary(client);
		await verifyConcurrentBoundary(client, connectionString);
		await verifyBoundedMergePlan(client);
		console.info("Entity measurement cardinality and bounded merge plans verified.");
	} finally {
		await cleanupFixture(client);
	}
} finally {
	await client.end();
}
