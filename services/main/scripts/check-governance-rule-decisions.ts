import { Client } from "pg";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const Timestamp = "2026-08-11T19:30:00.000Z";

const AuthUserId = "73000000-0000-7000-8000-000000000001";
const ProfileId = "73100000-0000-7000-8000-000000000001";
const RealmId = "73200000-0000-7000-8000-000000000001";
const RevisionId = "73300000-0000-7000-8000-000000000001";
const RuleId = "73400000-0000-7000-8000-000000000001";
const AppendRuleId = "73400000-0000-7000-8000-000000000002";
const MissingBasisDecisionId = "73500000-0000-7000-8000-000000000001";
const RuleDecisionId = "73500000-0000-7000-8000-000000000002";
const ReversalDecisionId = "73500000-0000-7000-8000-000000000003";

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function databaseErrorCode(error: unknown): string | undefined {
	return isRecord(error) && typeof error.code === "string" ? error.code : undefined;
}

async function expectDatabaseError(
	operation: () => Promise<unknown>,
	expectedCode: string,
	message: string,
): Promise<void> {
	try {
		await operation();
	} catch (error) {
		assert(
			databaseErrorCode(error) === expectedCode,
			`${message}; expected PostgreSQL ${expectedCode}, received ${databaseErrorCode(error) ?? "no code"}`,
		);
		return;
	}
	throw new Error(`${message}; operation unexpectedly succeeded`);
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
		"Governance decision fixtures may run only in the disposable rezics_atlas database",
	);
}

async function seedRuleGraph(client: Client): Promise<void> {
	await client.query("begin");
	try {
		await client.query(
			`insert into public.users (
				id, name, email, email_verified, registration_content_language, created_at, updated_at
			) values ($1, 'Governance fixture', 'governance-fixture@example.invalid', true, 'en', $2, $2)`,
			[AuthUserId, Timestamp],
		);
		await client.query(
			`insert into public.unit (id, kind, created_at, updated_at)
			values
				($1, 'profile', $5, $5),
				($2, 'realm', $5, $5),
				($3, 'realm_rule', $5, $5),
				($4, 'realm_rule', $5, $5)`,
			[ProfileId, RealmId, RuleId, AppendRuleId, Timestamp],
		);
		await client.query(
			`insert into public.profile (id, auth_user_id, joined_at, created_at, updated_at)
			values ($1, $2, $3, $3, $3)`,
			[ProfileId, AuthUserId, Timestamp],
		);
		await client.query(
			`insert into public.realm (id, created_at, updated_at) values ($1, $2, $2)`,
			[RealmId, Timestamp],
		);
		await client.query(
			`insert into public.realm_rule_revision (
				id, realm_id, version, created_by_profile_id, published_at
			) values ($1, $2, 1, $3, $4)`,
			[RevisionId, RealmId, ProfileId, Timestamp],
		);
		await client.query(
			`insert into public.realm_rule (id, revision_id, position, created_at)
			values ($1, $3, 0, $4), ($2, $3, 1, $4)`,
			[RuleId, AppendRuleId, RevisionId, Timestamp],
		);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}
}

async function verifyRemovedContracts(client: Client): Promise<void> {
	const removedTypes = await client.query<{ readonly name: string }>(
		`select typname as name
		from pg_catalog.pg_type
		where typnamespace = 'public'::regnamespace
			and typname = any($1::text[])`,
		[["governance_reason_code", "user_account_state_reason"]],
	);
	assert(removedTypes.rows.length === 0, "Legacy governance reason enum types still exist");

	const basis = await client.query<{ readonly value: string }>(
		`select enumlabel as value
		from pg_catalog.pg_enum
		where enumtypid = 'public.governance_decision_basis_kind'::regtype
		order by enumsortorder`,
	);
	assert(
		basis.rows.map(({ value }) => value).join(",") === "rules,reversal",
		"Governance decision basis must contain only rules and reversal",
	);

	const authorities = await client.query<{ readonly value: string }>(
		`select enumlabel as value
		from pg_catalog.pg_enum
		where enumtypid = 'public.audit_authority_kind'::regtype
		order by enumsortorder`,
	);
	assert(
		authorities.rows.map(({ value }) => value).join(",") === "platform,realm,zone,unit",
		"Audit authority must support the Zone governance scope",
	);
}

async function verifyDecisionInvariants(client: Client): Promise<void> {
	await client.query("begin");
	await client.query(
		`insert into public.governance_decision (
			id, action, basis_kind, actor_profile_id, authority_kind,
			target_unit_id, subject_kind, subject_id, created_at
		) values ($1, 'fixture.missing_basis', 'rules', $2, 'platform', $2, 'fixture', $2, $3)`,
		[MissingBasisDecisionId, ProfileId, Timestamp],
	);
	await client.query("update public.governance_decision set finalized = true where id = $1", [
		MissingBasisDecisionId,
	]);
	await expectDatabaseError(
		() => client.query("commit"),
		"23514",
		"A Rule-backed governance decision without Rules must fail at commit",
	);
	await client.query("rollback");

	await client.query("begin");
	try {
		await client.query(
			`insert into public.governance_decision (
				id, action, basis_kind, actor_profile_id, authority_kind,
				target_unit_id, subject_kind, subject_id, created_at
			) values ($1, 'fixture.rule_decision', 'rules', $2, 'platform', $2, 'fixture', $2, $3)`,
			[RuleDecisionId, ProfileId, Timestamp],
		);
		await client.query(
			`insert into public.governance_decision_rule (
				decision_id, rule_source_realm_id, rule_revision_id, rule_id, created_at
			) values ($1, $2, $3, $4, $5)`,
			[RuleDecisionId, RealmId, RevisionId, RuleId, Timestamp],
		);
		await client.query("update public.governance_decision set finalized = true where id = $1", [
			RuleDecisionId,
		]);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}

	await client.query("begin");
	try {
		await client.query(
			`insert into public.governance_decision (
				id, action, basis_kind, actor_profile_id, authority_kind,
				target_unit_id, subject_kind, subject_id, reverses_decision_id, created_at
			) values ($1, 'fixture.reversal', 'reversal', $2, 'platform', $2, 'fixture', $2, $3, $4)`,
			[ReversalDecisionId, ProfileId, RuleDecisionId, Timestamp],
		);
		await client.query("update public.governance_decision set finalized = true where id = $1", [
			ReversalDecisionId,
		]);
		await client.query("commit");
	} catch (error) {
		await client.query("rollback");
		throw error;
	}

	await expectDatabaseError(
		() =>
			client.query(
				`insert into public.governance_decision_rule (
					decision_id, rule_source_realm_id, rule_revision_id, rule_id, created_at
				) values ($1, $2, $3, $4, $5)`,
				[RuleDecisionId, RealmId, RevisionId, AppendRuleId, Timestamp],
			),
		"55000",
		"Finalized governance Rule bases must reject appended Rules",
	);
	await expectDatabaseError(
		() =>
			client.query(
				"update public.governance_decision set action = 'fixture.changed' where id = $1",
				[RuleDecisionId],
			),
		"55000",
		"Governance decisions must be immutable",
	);
	await expectDatabaseError(
		() =>
			client.query("delete from public.governance_decision_rule where decision_id = $1", [
				RuleDecisionId,
			]),
		"55000",
		"Governance Rule bases must be immutable",
	);
}

async function verifyHistoryIndexPlans(client: Client): Promise<void> {
	await client.query("set enable_seqscan = off");
	try {
		const targetPlan = await client.query(
			`explain (format json)
			select id
			from public.governance_decision
			where target_unit_id = $1
			order by created_at desc nulls last, id desc nulls last
			limit 50`,
			[ProfileId],
		);
		assert(
			JSON.stringify(targetPlan.rows).includes("governance_decision_target_created_idx"),
			"Target history query must be eligible for its keyset index",
		);

		const subjectPlan = await client.query(
			`explain (format json)
			select id
			from public.governance_decision
			where subject_kind = 'fixture' and subject_id = $1
			order by created_at desc nulls last, id desc nulls last
			limit 50`,
			[ProfileId],
		);
		assert(
			JSON.stringify(subjectPlan.rows).includes("governance_decision_subject_created_idx"),
			"Subject history query must be eligible for its keyset index",
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
	await verifyRemovedContracts(client);
	await seedRuleGraph(client);
	await verifyDecisionInvariants(client);
	await verifyHistoryIndexPlans(client);
	console.info("Governance Rule decision database invariants verified.");
} finally {
	await client.end();
}
