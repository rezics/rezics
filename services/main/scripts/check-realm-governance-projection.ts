import assert from "node:assert/strict";
import { Pool } from "pg";
const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable projection fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error("Requires isolated loopback Atlas target");
const pool = new Pool({ connectionString, max: 1 }),
	db = await pool.connect();
let assertions = 0;
const equal = (actual: unknown, expected: unknown) => {
	assert.deepEqual(actual, expected);
	assertions++;
};
async function id(statement: string, values: unknown[] = []): Promise<string> {
	const result = await db.query<{ id: string }>(statement, values);
	assert.ok(result.rows[0]);
	return result.rows[0].id;
}
async function rejects(statement: string, values: unknown[] = []) {
	await db.query("savepoint expected_rejection");
	try {
		await db.query(statement, values);
		throw new Error("Expected projection invariant rejection");
	} catch (error) {
		assert.equal(
			typeof error === "object" && error !== null && "code" in error ? error.code : null,
			"23514",
		);
		assertions++;
	} finally {
		await db.query("rollback to savepoint expected_rejection");
	}
}
try {
	await db.query("begin");
	const actor = await id("insert into entity_identity(shape) values ('unresolved') returning id");
	const realm = await id("insert into realm default values returning id"),
		otherRealm = await id("insert into realm default values returning id"),
		resource = await id("insert into realm default values returning id");
	await db.query("insert into realm_unit(realm_id,unit_id) values ($1,$3),($2,$3)", [
		realm,
		otherRealm,
		resource,
	]);
	const caseId = await id(
		"insert into content_review_case(authority,realm_id,target_unit_id) values ('realm',$1,$2) returning id",
		[realm, resource],
	);
	const otherCase = await id(
		"insert into content_review_case(authority,realm_id,target_unit_id) values ('realm',$1,$2) returning id",
		[otherRealm, resource],
	);
	const rules = new Map<string, { revisionId: string; ruleId: string }>();
	for (const realmId of [realm, otherRealm]) {
		const revisionId = await id(
			"insert into realm_rule_revision(realm_id,version,created_by_profile_id) values ($1,1,$2) returning id",
			[realmId, actor],
		);
		const ruleId = await id(
			"insert into realm_rule(revision_id,position) values ($1,1) returning id",
			[revisionId],
		);
		rules.set(realmId, { revisionId, ruleId });
	}
	async function decision(caseRef: string, kind: string) {
		const realmId = caseRef === caseId ? realm : otherRealm,
			rule = rules.get(realmId);
		assert.ok(rule);
		const decisionId = await id(
			"insert into governance_decision(action,basis_kind,actor_profile_id,authority_kind,authority_realm_id,target_unit_id,subject_kind,subject_id) values ($1,'rules',$2,'realm',$3,$4,'content_review_case',$5) returning id",
			[`content_governance.${kind}`, actor, realmId, resource, caseRef],
		);
		await db.query(
			"insert into governance_decision_rule(decision_id,rule_source_realm_id,rule_revision_id,rule_id) values ($1,$2,$3,$4)",
			[decisionId, realmId, rule.revisionId, rule.ruleId],
		);
		await db.query("update governance_decision set finalized=true where id=$1", [decisionId]);
		return decisionId;
	}
	async function action(caseRef: string, instant: string) {
		return id(
			"insert into content_governance_action(case_id,actor_profile_id,kind,previous_state,resulting_state,created_at,decision_id) values ($1,$2,'hide','visible','hidden',$3,$4) returning id",
			[caseRef, actor, instant, await decision(caseRef, "hide")],
		);
	}
	async function pointer() {
		const rows = await db.query<{ latest_governance_action_id: string | null }>(
			"select latest_governance_action_id from realm_unit where realm_id=$1 and unit_id=$2",
			[realm, resource],
		);
		return rows.rows[0]?.latest_governance_action_id;
	}
	equal(await pointer(), null);
	let prior: string | null = null;
	for (let cycle = 0; cycle < 3; cycle++) {
		const year = 2030 + cycle;
		const first = await action(caseId, `${year}-01-02T00:00:00Z`);
		equal(await pointer(), first);
		const older = await action(caseId, `${year}-01-01T00:00:00Z`);
		equal(await pointer(), first);
		const sameTime = await action(caseId, `${year}-01-02T00:00:00Z`);
		const expected = [first, sameTime].sort().at(-1);
		equal(await pointer(), expected);
		const latest = await action(caseId, `${year}-01-03T00:00:00Z`);
		equal(await pointer(), latest);
		const foreign = await action(otherCase, `${year}-01-04T00:00:00Z`);
		equal(await pointer(), latest);
		await rejects(
			"update realm_unit set latest_governance_action_id=$1 where realm_id=$2 and unit_id=$3",
			[foreign, realm, resource],
		);
		await rejects(
			"update realm_unit set latest_governance_action_id=$1 where realm_id=$2 and unit_id=$3",
			[older, realm, resource],
		);
		await rejects(
			"update realm_unit set latest_governance_action_id=null where realm_id=$1 and unit_id=$2",
			[realm, resource],
		);
		await rejects(
			"update content_governance_action set created_at=created_at+interval '1 day' where id=$1",
			[latest],
		);
		await rejects("update content_review_case set realm_id=$1 where id=$2", [otherRealm, caseId]);
		const lock = await id(
			"insert into content_governance_action(case_id,actor_profile_id,kind,previous_post_targeting_locked,resulting_post_targeting_locked,created_at,decision_id) values ($1,$2,'lock_post_targeting',false,true,$3,$4) returning id",
			[caseId, actor, `${year}-01-05T00:00:00Z`, await decision(caseId, "lock_post_targeting")],
		);
		equal(await pointer(), latest);
		await rejects(
			"update realm_unit set latest_governance_action_id=$1 where realm_id=$2 and unit_id=$3",
			[lock, realm, resource],
		);
		if (prior)
			await rejects(
				"update realm_unit set latest_governance_action_id=$1 where realm_id=$2 and unit_id=$3",
				[prior, realm, resource],
			);
		prior = latest;
	}
	await db.query("set constraints governance_decision_rule_basis_from_decision immediate");
	assertions++;
	const plan = await db.query(
		"explain (format json) select realm_id,latest_governance_action_id from realm_unit where unit_id=$1 order by updated_at desc,realm_id desc limit 100",
		[resource],
	);
	assert.ok(plan.rows.length);
	assertions++;
	console.log(
		JSON.stringify({
			assertions,
			rollback: true,
			scope:
				"latest Realm state-action ordering, exact scope, immutable evidence; single-session deterministic order, not concurrent throughput",
		}),
	);
} finally {
	await db.query("rollback");
	db.release();
	await pool.end();
}
