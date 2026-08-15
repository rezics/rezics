import { Client } from "pg";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const Timestamp = "2026-08-15T12:30:00.000Z";

const AuthUserId = "74000000-0000-7000-8000-000000000001";
const ProfileId = "74100000-0000-7000-8000-000000000001";
const CreditedEntityId = "74200000-0000-7000-8000-000000000001";
const ContentUnitId = "74300000-0000-7000-8000-000000000001";
const AiRevisionId = "74400000-0000-7000-8000-000000000001";
const MissingCreditRevisionId = "74400000-0000-7000-8000-000000000002";
const HumanRevisionId = "74400000-0000-7000-8000-000000000003";

interface TriggerRow {
	readonly name: string;
	readonly deferrable: boolean;
	readonly initiallyDeferred: boolean;
	readonly definition: string;
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function databaseErrorField(error: unknown, field: "code" | "constraint"): string | undefined {
	return isRecord(error) && typeof error[field] === "string" ? error[field] : undefined;
}

async function expectDatabaseError(
	operation: () => Promise<unknown>,
	expected: { readonly code: string; readonly constraint?: string },
	message: string,
): Promise<void> {
	try {
		await operation();
	} catch (error) {
		const code = databaseErrorField(error, "code");
		const constraint = databaseErrorField(error, "constraint");
		assert(
			code === expected.code,
			`${message}; expected PostgreSQL ${expected.code}, received ${code}`,
		);
		if (expected.constraint)
			assert(
				constraint === expected.constraint,
				`${message}; expected constraint ${expected.constraint}, received ${constraint}`,
			);
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
		"Revision contribution fixtures may run only in the disposable rezics_atlas database",
	);
}

async function verifyTriggerInstallation(client: Client): Promise<void> {
	const result = await client.query<TriggerRow>(
		`select
			tgname as name,
			tgdeferrable as deferrable,
			tginitdeferred as "initiallyDeferred",
			pg_get_triggerdef(oid) as definition
		from pg_catalog.pg_trigger
		where tgrelid in (
			'public.unit_revision'::regclass,
			'public.unit_revision_credit_attribution'::regclass
		)
			and tgname = any($1::text[])`,
		[
			[
				"unit_revision_primary_contribution_from_revision",
				"unit_revision_primary_contribution_from_credit",
				"unit_revision_credit_attribution_immutable",
				"unit_revision_credit_reject_merged_entity",
			],
		],
	);
	const triggers = new Map(result.rows.map((row) => [row.name, row]));
	for (const name of [
		"unit_revision_primary_contribution_from_revision",
		"unit_revision_primary_contribution_from_credit",
	]) {
		const trigger = triggers.get(name);
		assert(trigger?.deferrable === true, `${name} must be a constraint trigger`);
		assert(trigger.initiallyDeferred === true, `${name} must be initially deferred`);
	}
	assert(
		triggers
			.get("unit_revision_credit_attribution_immutable")
			?.definition.includes("reject_immutable_history_mutation"),
		"Revision credit attribution must install its append-only trigger",
	);
	assert(
		triggers
			.get("unit_revision_credit_reject_merged_entity")
			?.definition.includes("reject_merged_unit_reference('credited_entity_id')"),
		"Revision credit attribution must reject new references to merged Entities",
	);
}

async function seedFixtureOwners(client: Client): Promise<void> {
	await client.query("begin");
	try {
		await client.query(
			`insert into public.users (
				id, name, email, email_verified, registration_content_language, created_at, updated_at
			) values ($1, 'Revision contribution fixture', 'revision-contribution@example.invalid', true, 'en', $2, $2)`,
			[AuthUserId, Timestamp],
		);
		await client.query(
			`insert into public.unit (id, kind, created_at, updated_at)
			values
				($1, 'profile', $4, $4),
				($2, 'software', $4, $4),
				($3, 'book', $4, $4)`,
			[ProfileId, CreditedEntityId, ContentUnitId, Timestamp],
		);
		await client.query(
			`insert into public.profile (id, auth_user_id, joined_at, created_at, updated_at)
			values ($1, $2, $3, $3, $3)`,
			[ProfileId, AuthUserId, Timestamp],
		);
		await client.query(
			`insert into public.entity (id, kind, created_at, updated_at)
			values ($1, 'software_agent', $2, $2)`,
			[CreditedEntityId, Timestamp],
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}

async function verifyContributionIntegrity(client: Client): Promise<void> {
	await client.query("begin");
	try {
		await client.query(
			`insert into public.unit_revision (
				id, unit_id, actor_profile_id, primary_contribution_kind, byte_size, created_at
			) values ($1, $2, $3, 'ai', 0, $4)`,
			[AiRevisionId, ContentUnitId, ProfileId, Timestamp],
		);
		await client.query(
			`insert into public.unit_revision_credit_attribution (
				revision_id, credited_entity_id, role, assurance
			) values ($1, $2, 'editor', 'self_declared')`,
			[AiRevisionId, CreditedEntityId],
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}

	await client.query("begin");
	await client.query(
		`insert into public.unit_revision (
			id, unit_id, actor_profile_id, primary_contribution_kind, byte_size, created_at
		) values ($1, $2, $3, 'ai', 0, $4)`,
		[MissingCreditRevisionId, ContentUnitId, ProfileId, Timestamp],
	);
	await expectDatabaseError(
		() => client.query("commit"),
		{ code: "23514", constraint: "unit_revision_primary_contribution_integrity" },
		"An AI revision without credit attribution must fail at commit",
	);
	await client.query("rollback");

	await client.query(
		`insert into public.unit_revision (
			id, unit_id, actor_profile_id, primary_contribution_kind, byte_size, created_at
		) values ($1, $2, $3, 'human', 0, $4)`,
		[HumanRevisionId, ContentUnitId, ProfileId, Timestamp],
	);
	await expectDatabaseError(
		() =>
			client.query(
				`insert into public.unit_revision_credit_attribution (
					revision_id, credited_entity_id, role, assurance
				) values ($1, $2, 'editor', 'self_declared')`,
				[HumanRevisionId, CreditedEntityId],
			),
		{ code: "23514", constraint: "unit_revision_primary_contribution_integrity" },
		"A non-AI revision with credit attribution must fail at commit",
	);
	await expectDatabaseError(
		() =>
			client.query(
				"update public.unit_revision_credit_attribution set role = 'creator' where revision_id = $1",
				[AiRevisionId],
			),
		{ code: "55000" },
		"Revision credit attribution must be immutable",
	);
	await expectDatabaseError(
		() =>
			client.query(
				"update public.unit_revision set primary_contribution_kind = 'human' where id = $1",
				[AiRevisionId],
			),
		{ code: "55000" },
		"The revision contribution discriminator must be immutable",
	);
}

async function verifyBoundedJoinPlans(client: Client): Promise<void> {
	await client.query("set enable_seqscan = off");
	try {
		const historyPlan = await client.query(
			`explain (format json)
			select revision.id, attribution.role
			from public.unit_revision as revision
			left join public.unit_revision_credit_attribution as attribution
				on attribution.revision_id = revision.id
			where revision.unit_id = $1
			order by revision.created_at desc, revision.id desc
			limit 100`,
			[ContentUnitId],
		);
		const historyPlanJson = JSON.stringify(historyPlan.rows);
		assert(
			historyPlanJson.includes("unit_revision_unit_created_at_idx"),
			"Revision history must be eligible for its bounded keyset index",
		);
		assert(
			historyPlanJson.includes("unit_revision_credit_attribution_pkey"),
			"Revision history must probe credit attribution by revision primary key",
		);

		const entityPlan = await client.query(
			`explain (format json)
			select revision_id
			from public.unit_revision_credit_attribution
			where credited_entity_id = $1
			order by revision_id desc
			limit 100`,
			[CreditedEntityId],
		);
		assert(
			JSON.stringify(entityPlan.rows).includes(
				"unit_revision_credit_attribution_entity_revision_idx",
			),
			"Entity-scoped revision credit reads must be eligible for their keyset index",
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
	await verifyTriggerInstallation(client);
	await seedFixtureOwners(client);
	await verifyContributionIntegrity(client);
	await verifyBoundedJoinPlans(client);
	console.info("Unit revision contribution database invariants verified.");
} finally {
	await client.end();
}
