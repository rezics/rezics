import assert from "node:assert/strict";
import { Pool } from "pg";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { users, realm as realmTable, unitOwnership } from "../src/services/database/schema";
import { createSeedParticipant } from "../src/services/seed/enrollment";
import {
	createFixtureSessionContext,
	assertNativeEnrollmentFixture,
} from "./native-enrollment-fixture";
import { joinRealm, leaveRealm, updateRealmMember } from "../src/services/realms/membership";
import { readRealmEnrollment } from "../src/services/realms/roster";
import type { PrincipalRequestContext } from "../src/services/auth/principal-context";
assertNativeEnrollmentFixture();
const connectionString = process.env.DATABASE_URL ?? process.env.DATABASE_ADMIN_URL;
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
async function rejects(statement: string, values: unknown[] = [], code = "23514") {
	await db.query("savepoint expected_rejection");
	try {
		await db.query(statement, values);
		throw new Error("Expected projection invariant rejection");
	} catch (error) {
		assert.equal(
			typeof error === "object" && error !== null && "code" in error ? error.code : null,
			code,
		);
		assertions++;
	} finally {
		await db.query("rollback to savepoint expected_rejection");
	}
}
const native = drizzle({ client: db });
const rollback = new Error("Rollback native Realm governance projection fixture");
try {
	await assert.rejects(
		native.transaction(async (tx) => {
			async function actorWithContext(name: string) {
				const [account] = await tx
					.insert(users)
					.values({
						name: "Private projection operator",
						email: `${randomUUID()}@projection.invalid`,
						emailVerified: true,
					})
					.returning();
				assert.ok(account);
				return {
					account,
					...(await createSeedParticipant(tx, account.id, { language: "en", value: name })),
				};
			}
			const operator = await actorWithContext("Projection governor"),
				firstMember = await actorWithContext("First member"),
				secondMember = await actorWithContext("Second member");
			const actor = operator.id;
			async function managedRealm(approval = false) {
				const [value] = await tx
					.insert(realmTable)
					.values({
						status: "published",
						visibility: "public",
						publishedAt: new Date(),
						joinPolicy: approval ? "approval" : "open",
					})
					.returning();
				assert.ok(value);
				await tx
					.insert(unitOwnership)
					.values({ unitId: value.id, profileId: operator.id, assignedByProfileId: operator.id });
				return value.id;
			}
			const realm = await managedRealm(true),
				otherRealm = await managedRealm(),
				resource = await managedRealm();
			const count = async (realmId: string) =>
				Number(
					(
						await db.query<{ active_member_count: string }>(
							"select active_member_count from realm_stat where realm_id=$1",
							[realmId],
						)
					).rows[0]?.active_member_count,
				);
			const state = async (context: PrincipalRequestContext, realmId: string) =>
				readRealmEnrollment(tx, context, realmId);
			const expected = (value: Awaited<ReturnType<typeof state>>) => ({
				operationId: randomUUID(),
				expectedControlRevision: value.controlRevision,
				expectedRevision: value.receipt?.revision ?? 0,
				expectedMembershipVersion: value.receipt?.version ?? 0,
				expectedEnforcementRevision: value.receipt?.enforcementRevision ?? 0,
			});
			async function settled<T>(command: Promise<T>): Promise<T> {
				const result = await command;
				// Validate each completed command before a later generation replaces its current head.
				await db.query("set constraints all immediate");
				await db.query("set constraints all deferred");
				return result;
			}
			const join = async (context: PrincipalRequestContext, realmId: string) =>
				settled(
					joinRealm(tx, context, realmId, {
						...expected(await state(context, realmId)),
						consent: true,
						ruleRevisionId: null,
					}),
				);
			const leave = async (context: PrincipalRequestContext, realmId: string) =>
				settled(leaveRealm(tx, context, realmId, expected(await state(context, realmId))));
			async function moderate(
				member: typeof firstMember,
				realmId: string,
				operation: "approve" | "mute" | "clear" | "ban",
			) {
				return settled(
					updateRealmMember(tx, operator.context, realmId, {
						...expected(await state(member.context, realmId)),
						operation,
						recipient: { kind: "entity", entityId: member.id },
					}),
				);
			}
			equal(await count(realm), 0);
			await join(firstMember.context, realm);
			await join(secondMember.context, realm);
			equal(await count(realm), 0);
			await moderate(firstMember, realm, "approve");
			equal(await count(realm), 1);
			await moderate(firstMember, realm, "mute");
			equal(await count(realm), 0);
			await moderate(firstMember, realm, "clear");
			equal(await count(realm), 1);
			await moderate(firstMember, realm, "clear");
			equal(await count(realm), 1);
			const clearBody = {
				...expected(await state(firstMember.context, realm)),
				operation: "clear" as const,
				recipient: { kind: "entity" as const, entityId: firstMember.id },
			};
			const cleared = await updateRealmMember(tx, operator.context, realm, clearBody);
			equal(await updateRealmMember(tx, operator.context, realm, clearBody), cleared);
			equal(await count(realm), 1);
			await moderate(secondMember, realm, "approve");
			equal(await count(realm), 2);
			await state(secondMember.context, otherRealm);
			const admitted = await state(firstMember.context, realm);
			assert.ok(admitted.receipt);
			await rejects(
				"update access_membership set scope_id=(select id from access_scope where unit_ref=(select id from reference_value where target_realm_id=$1)),version=version+1 where id=$2",
				[otherRealm, admitted.receipt.membershipId],
				"55000",
			);
			await rejects(
				"delete from access_membership where id=$1",
				[admitted.receipt.membershipId],
				"55000",
			);
			await leave(firstMember.context, realm);
			equal(await count(realm), 1);
			await leave(secondMember.context, realm);
			equal(await count(realm), 0);
			await join(secondMember.context, otherRealm);
			equal(await count(otherRealm), 1);
			await leave(secondMember.context, otherRealm);
			equal(await count(otherRealm), 0);
			await join(firstMember.context, realm);
			await moderate(firstMember, realm, "approve");
			equal(await count(realm), 1);
			const rejoined = await state(firstMember.context, realm);
			assert.ok(rejoined.receipt);
			equal(
				[rejoined.receipt.membershipId, rejoined.receipt.activeGeneration],
				[admitted.receipt.membershipId, 2],
			);
			for (const corruption of [
				"delete from realm_stat where realm_id=$1",
				"update realm_stat set active_member_count=0 where realm_id=$1",
			]) {
				await db.query("savepoint counter_corruption");
				await db.query(corruption, [realm]);
				const before = await state(firstMember.context, realm);
				await assert.rejects(
					tx.transaction((nested) =>
						leaveRealm(nested, firstMember.context, realm, expected(before)),
					),
					(error) => {
						let cause: unknown = error;
						while (cause instanceof Error && cause.cause) cause = cause.cause;
						return (
							typeof cause === "object" &&
							cause !== null &&
							"code" in cause &&
							cause.code === "23514"
						);
					},
				);
				assertions++;
				await db.query("rollback to savepoint counter_corruption");
			}
			equal(await count(realm), 1);
			await moderate(firstMember, realm, "mute");
			equal(await count(realm), 0);
			await leave(firstMember.context, realm);
			equal(await count(realm), 0);
			await join(firstMember.context, realm);
			await moderate(firstMember, realm, "approve");
			equal(await count(realm), 0);
			await moderate(firstMember, realm, "clear");
			equal(await count(realm), 1);
			const privateMember = await createFixtureSessionContext(tx, secondMember.account.id);
			await join(privateMember, otherRealm);
			equal(await count(otherRealm), 0);
			await leave(privateMember, otherRealm);
			equal(await count(otherRealm), 0);
			const deletedRealm = await managedRealm();
			await join(firstMember.context, deletedRealm);
			await rejects("delete from realm where id=$1", [deletedRealm], "23001");
			await db.query("update realm set deleted_at=clock_timestamp() where id=$1", [deletedRealm]);
			equal(await count(deletedRealm), 1);
			await leave(firstMember.context, deletedRealm);
			equal(await count(deletedRealm), 0);
			equal(
				(
					await db.query(
						"select count(*)::integer as n from current_realm_entity_membership where realm_id=$1 and profile_id=$2",
						[deletedRealm, firstMember.id],
					)
				).rows[0]?.n,
				1,
			);

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
				await rejects("update content_review_case set realm_id=$1 where id=$2", [
					otherRealm,
					caseId,
				]);
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
			await db.query("set constraints all immediate");
			assertions++;
			const plan = await db.query(
				"explain (format json) select realm_id,latest_governance_action_id from realm_unit where unit_id=$1 order by updated_at desc,realm_id desc limit 100",
				[resource],
			);
			assert.ok(plan.rows.length);
			assertions++;
			const root = new URL("../../../", import.meta.url),
				sourceDigests: Record<string, string> = {};
			for (const path of [
				"services/main/scripts/check-realm-governance-projection.ts",
				"services/main/src/services/realms/membership.ts",
				"services/main/src/services/realms/membership-notifications.ts",
				"services/main/src/services/database/schema/postgres/realm-enrollment.sql",
				"services/main/src/services/database/migrations/atlas.sum",
			])
				sourceDigests[path] = createHash("sha256")
					.update(await readFile(new URL(path, root)))
					.digest("hex");
			console.info(
				JSON.stringify({
					baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
						cwd: fileURLToPath(root),
						encoding: "utf8",
					}).trim(),
					sourceDigests,
					assertions,
					rollback: true,
					scope:
						"Native public/private enrollment counters, approval, independent enforcement and retained generations; latest governance projection, exact scope and immutable evidence. Fixture ownership/grants are privileged setup; no concurrent throughput claim.",
				}),
			);
			throw rollback;
		}),
		(error) => error === rollback,
	);
} finally {
	db.release();
	await pool.end();
}
