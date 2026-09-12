import { allocateReferenceValue, referenceValueIdForNativeId } from "../src/services/units/reference-value";
import assert from "node:assert/strict";
import { initializeObservability } from "@rezics/observability";
import { desc, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { OfficialRealmUnitIds } from "@rezics/slug";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	authEntity,
	post,
	accountFollowPreference,
	unitAccessGrant,
	unitFollow,
	realm,
	realmRule,
	realmRuleRevision,
	platformCapabilityGrant,
	accountEnforcement,
	accountEnforcementAction,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { AccountClosed, AccountSuspended } from "../src/services/auth/errors";
import { AccountRestricted } from "../src/services/authorization/errors";
import { UnitNotFound } from "../src/services/units/errors";
import { replacePlatformUserAccountState } from "../src/services/platform-users/service";
import { createGovernanceDecision } from "../src/services/governance/decision-service";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
import { ParticipationDenied } from "../src/services/participation/policy";
import {
	followUnit,
	unfollowUnit,
	updateFollowingPresentation,
	getFollowingStatus,
	listFollowing,
	replaceFollowingSettings,
} from "../src/services/following/service";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
);
const observability = initializeObservability({
	service: { name: "following-authority-fixture", version: "1", environment: "tooling" },
});
let checks = 0;
async function actor(tx: DatabaseTransaction, name: string) {
	const [account] = await tx
		.insert(users)
		.values({ name, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	const authority = {
		principal: { kind: "auth" as const, authUserId: account.id },
		actingEntityId: self.id,
		authorizationRevision: self.authorizationRevision,
	};
	return {
		account,
		self,
		authority,
		authorization: new Authorization(self.id, account.id, authority),
	};
}
type Actor = Awaited<ReturnType<typeof actor>>;
async function targetPost(tx: DatabaseTransaction) {
	const [resource] = await tx
		.insert(post)
		.values({ status: "published", visibility: "public", publishedAt: new Date() })
		.returning();
	assert.ok(resource);
	return resource;
}
function input(person: Actor, unitId: string) {
	return {
		authUserId: person.account.id,
		followerProfileId: person.self.id,
		authorization: person.authorization,
		unitId,
	};
}
function operations(person: Actor, unitId: string) {
	const data = input(person, unitId);
	return {
		follow: () => followUnit(data),
		status: () => getFollowingStatus(data),
		list: () => listFollowing({ ...data, limit: 30 }),
		settings: () =>
			replaceFollowingSettings({
				...data,
				settings: {
					owner: "post",
					inAppNotificationsEnabled: false,
					realmTagSourceSubscribed: null,
				},
			}),
		presentation: () =>
			updateFollowingPresentation(
				person.account.id,
				person.self.id,
				unitId,
				{ favorite: true },
				person.authorization,
			),
		unfollow: () => unfollowUnit(person.account.id, person.self.id, unitId, person.authorization),
	};
}
async function ruleBasis(tx: DatabaseTransaction, operator: Actor) {
	await tx.insert(realm).values({ id: OfficialRealmUnitIds.rule }).onConflictDoNothing();
	let [revision] = await tx
		.select()
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, OfficialRealmUnitIds.rule))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1);
	if (!revision)
		[revision] = await tx
			.insert(realmRuleRevision)
			.values({
				realmId: OfficialRealmUnitIds.rule,
				version: 1,
				createdByProfileId: operator.self.id,
				publishedAt: new Date(),
			})
			.returning();
	assert.ok(revision);
	let [rule] = await tx
		.select()
		.from(realmRule)
		.where(eq(realmRule.revisionId, revision.id))
		.limit(1);
	if (!rule)
		[rule] = await tx
			.insert(realmRule)
			.values({ revisionId: revision.id, position: 0 })
			.returning();
	assert.ok(rule);
	return {
		sourceRealmId: OfficialRealmUnitIds.rule,
		revisionId: revision.id,
		ruleId: rule.id,
	};
}
const rollback = new Error("rollback following authority fixture");
try {
	await withDatabaseTransactionDeadline(60000, () =>
		database.transaction(async (tx) => {
			const person = await actor(tx, "Following authority owner"),
				operator = await actor(tx, "Following authority moderator");
			const resource = await targetPost(tx);
			await followUnit(input(person, resource.id));
			assert.equal(
				(
					await tx
						.select()
						.from(accountFollowPreference)
						.where(eq(accountFollowPreference.authUserId, person.account.id))
				).length,
				1,
			);
			checks++;
			await tx
				.update(authEntity)
				.set({ revision: sql`${authEntity.revision}+1` })
				.where(eq(authEntity.authUserId, person.account.id));
			for (const work of Object.values(operations(person, resource.id))) {
				await assert.rejects(
					tx.transaction<unknown>(() => work()),
					ParticipationDenied,
				);
				checks++;
			}
			const fresh = {
				...person,
				authority: {
					...person.authority,
					authorizationRevision: person.authority.authorizationRevision + 1,
				},
				authorization: new Authorization(person.self.id, person.account.id, {
					...person.authority,
					authorizationRevision: person.authority.authorizationRevision + 1,
				}),
			};
			assert.equal((await getFollowingStatus(input(fresh, resource.id))).following, true);
			checks++;
			await assert.rejects(
				tx.transaction(() =>
					followUnit({ ...input(fresh, resource.id), authorization: operator.authorization }),
				),
				ParticipationDenied,
			);
			checks++;
			const basis = await ruleBasis(tx, operator);
			await tx.insert(platformCapabilityGrant).values({
				authUserId: operator.account.id,
				capability: "platform.user.status.update",
				grantedByAuthUserId: operator.account.id,
			});
			let accountRevision = 0;
			for (const state of ["suspended", "active", "closed", "active"] as const) {
				await replacePlatformUserAccountState({
					authorization: operator.authorization,
					targetUserId: person.account.id,
					command: { state, expectedRevision: accountRevision++, rules: [basis] },
				});
				if (state !== "active")
					for (const work of Object.values(operations(fresh, resource.id))) {
						await assert.rejects(
							tx.transaction<unknown>(() => work()),
							state === "suspended" ? AccountSuspended : AccountClosed,
						);
						checks++;
					}
			}
			for (const kind of ["ban", "suspension", "silence"] as const) {
				const undo = new Error(`rollback ${kind}`);
				await assert.rejects(
					tx.transaction(async (nested) => {
						await nested
							.select({ id: users.id })
							.from(users)
							.where(eq(users.id, person.account.id))
							.for("update");
						const decision = await createGovernanceDecision(nested, {
							action: "account.enforcement.create",
							actorProfileId: operator.self.id,
							authority: { kind: "platform" },
							targetUserId: person.account.id,
							subject: { kind: "auth", id: person.account.id },
							basis: { kind: "rules", rules: [basis] },
						});
						const [action] = await nested
							.insert(accountEnforcementAction)
							.values({
								decisionId: decision.id,
								actorAuthUserId: operator.account.id,
								targetAuthUserId: person.account.id,
								kind: "issue",
								enforcementKind: kind,
							})
							.returning();
						assert.ok(action);
						await nested
							.insert(accountEnforcement)
							.values({ authUserId: person.account.id, kind, decisionActionId: action.id });
						const actions = operations(fresh, resource.id);
						for (const work of [actions.status, actions.list]) {
							await work();
							checks++;
						}
						await assert.rejects(nested.transaction(actions.follow), AccountRestricted);
						checks++;
						for (const work of [actions.settings, actions.presentation, actions.unfollow]) {
							if (kind === "silence") await work();
							else
								await assert.rejects(
									nested.transaction<unknown>(() => work()),
									AccountRestricted,
								);
							checks++;
						}
						throw undo;
					}),
					(error) => error === undo,
				);
			}
			assert.equal((await getFollowingStatus(input(fresh, resource.id))).following, true);
			checks++;
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}
async function fixture() {
	return database.transaction(async (tx) => ({
		person: await actor(tx, "Following race"),
		resource: await targetPost(tx),
	}));
}
async function observe(worker: number, holder: number) {
	for (let attempt = 0; attempt < 300; attempt++) {
		if (
			(
				await database.execute<{ blocked: boolean }>(
					sql`select ${holder}=any(pg_blocking_pids(${worker})) as blocked`,
				)
			).rows[0]?.blocked
		) {
			checks++;
			return;
		}
		await setTimeout(10);
	}
	throw new Error("The exact Following worker did not meet its holder");
}
for (const change of ["self", "target"] as const) {
	const { person, resource } = await fixture(),
		ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>();
	const changing = database.transaction(async (tx) => {
		if (change === "self")
			await tx
				.update(authEntity)
				.set({ revision: sql`${authEntity.revision}+1` })
				.where(eq(authEntity.authUserId, person.account.id));
		else {
			await lockUnitAccessState(tx, [resource.id]);
			await tx.update(post).set({ visibility: "private" }).where(eq(post.id, resource.id));
		}
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void changing.catch(ready.reject);
	const holder = await ready.promise,
		started = Promise.withResolvers<number>();
	const saving = withDatabaseTransactionDeadline(10000, async () => {
		started.resolve(
			(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return followUnit(input(person, resource.id));
	});
	void saving.catch(started.reject);
	const denied = assert.rejects(saving, change === "self" ? ParticipationDenied : UnitNotFound);
	void denied.catch(() => {});
	try {
		await observe(await started.promise, holder);
	} finally {
		release.resolve();
		await Promise.all([changing, denied]);
	}
	assert.equal(
		(await database.select().from(unitFollow).where(eq(unitFollow.targetReferenceId, referenceValueIdForNativeId(resource.id)))).length,
		0,
	);
	checks++;
}
// A private read grant must still be valid after an existing preference row stops blocking an update.
const expiry = await fixture();
const grant = await database.transaction(async (tx) => {
	await tx.update(post).set({ visibility: "private" }).where(eq(post.id, expiry.resource.id));
	const [row] = await tx
		.insert(unitAccessGrant)
		.values({
			unitId: expiry.resource.id,
			subjectKind: "auth",
			authUserId: expiry.person.account.id,
			permission: "unit.read",
			scope: [],
			grantedByAuthUserId: expiry.person.account.id,
			expiresAt: new Date(Date.now() + 2500),
		})
		.returning();
	assert.ok(row);
	const targetReferenceId=await allocateReferenceValue(tx,{owner:"post",id:expiry.resource.id});
	await tx.insert(unitFollow).values({followerProfileId:expiry.person.self.id,targetReferenceId});
	await tx.insert(accountFollowPreference).values({
		authUserId: expiry.person.account.id,
		followerEntityId: expiry.person.self.id,
		targetReferenceId,
	});
	return row;
});
const held = Promise.withResolvers<number>(),
	releaseExpiry = Promise.withResolvers<void>();
const holding = database.transaction(async (tx) => {
	await tx
		.select()
		.from(accountFollowPreference)
		.where(eq(accountFollowPreference.authUserId, expiry.person.account.id))
		.for("update");
	held.resolve(
		(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	await releaseExpiry.promise;
	await tx.execute(
		sql`select pg_sleep(greatest(0,extract(epoch from ${grant.expiresAt}::timestamptz-statement_timestamp()))+0.1)`,
	);
});
void holding.catch(held.reject);
const holder = await held.promise,
	started = Promise.withResolvers<number>();
const changing = withDatabaseTransactionDeadline(10000, async () => {
	started.resolve(
		(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	return replaceFollowingSettings({
		...input(expiry.person, expiry.resource.id),
		settings: { owner: "post", inAppNotificationsEnabled: false, realmTagSourceSubscribed: null },
	});
});
void changing.catch(started.reject);
const expired = assert.rejects(changing, UnitNotFound);
void expired.catch(() => {});
try {
	await observe(await started.promise, holder);
} finally {
	releaseExpiry.resolve();
	await Promise.all([holding, expired]);
}
assert.equal(
	(
		await database
			.select()
			.from(accountFollowPreference)
			.where(eq(accountFollowPreference.authUserId, expiry.person.account.id))
	)[0]?.inApp,
	true,
);
checks++;
await updateFollowingPresentation(
	expiry.person.account.id,
	expiry.person.self.id,
	expiry.resource.id,
	{ favorite: true },
	expiry.person.authorization,
);
assert.equal(
	(
		await database
			.select()
			.from(accountFollowPreference)
			.where(eq(accountFollowPreference.authUserId, expiry.person.account.id))
	)[0]?.favorite,
	true,
);
checks++;
await unfollowUnit(
	expiry.person.account.id,
	expiry.person.self.id,
	expiry.resource.id,
	expiry.person.authorization,
);
assert.equal(
	(
		await database
			.select()
			.from(accountFollowPreference)
			.where(eq(accountFollowPreference.authUserId, expiry.person.account.id))
	).length,
	0,
);
checks++;
// A scheduled account restriction can become active while a private row update waits.
const scheduled = await fixture();
await followUnit(input(scheduled.person, scheduled.resource.id));
const startsAt = await database.transaction(async (tx) => {
	const operator = await actor(tx, "Scheduled Following moderator"),
		basis = await ruleBasis(tx, operator);
	const decision = await createGovernanceDecision(tx, {
		action: "account.enforcement.create",
		actorProfileId: operator.self.id,
		authority: { kind: "platform" },
		targetUserId: scheduled.person.account.id,
		subject: { kind: "auth", id: scheduled.person.account.id },
		basis: { kind: "rules", rules: [basis] },
	});
	const [action] = await tx
		.insert(accountEnforcementAction)
		.values({
			decisionId: decision.id,
			actorAuthUserId: operator.account.id,
			targetAuthUserId: scheduled.person.account.id,
			kind: "issue",
			enforcementKind: "ban",
		})
		.returning();
	assert.ok(action);
	const start = new Date(Date.now() + 2500);
	await tx.insert(accountEnforcement).values({
		authUserId: scheduled.person.account.id,
		kind: "ban",
		decisionActionId: action.id,
		startsAt: start,
	});
	return start;
});
const scheduledReady = Promise.withResolvers<number>(),
	scheduledRelease = Promise.withResolvers<void>();
const scheduleHolder = database.transaction(async (tx) => {
	await tx
		.select()
		.from(accountFollowPreference)
		.where(eq(accountFollowPreference.authUserId, scheduled.person.account.id))
		.for("update");
	scheduledReady.resolve(
		(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	await scheduledRelease.promise;
	await tx.execute(
		sql`select pg_sleep(greatest(0,extract(epoch from ${startsAt}::timestamptz-statement_timestamp()))+0.1)`,
	);
});
void scheduleHolder.catch(scheduledReady.reject);
const schedulePid = await scheduledReady.promise,
	scheduleStarted = Promise.withResolvers<number>();
const scheduledUpdate = withDatabaseTransactionDeadline(10000, async () => {
	scheduleStarted.resolve(
		(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	return updateFollowingPresentation(
		scheduled.person.account.id,
		scheduled.person.self.id,
		scheduled.resource.id,
		{ favorite: true },
		scheduled.person.authorization,
	);
});
void scheduledUpdate.catch(scheduleStarted.reject);
const scheduleDenied = assert.rejects(scheduledUpdate, AccountRestricted);
void scheduleDenied.catch(() => {});
try {
	await observe(await scheduleStarted.promise, schedulePid);
} finally {
	scheduledRelease.resolve();
	await Promise.all([scheduleHolder, scheduleDenied]);
}
assert.equal(
	(
		await database
			.select()
			.from(accountFollowPreference)
			.where(eq(accountFollowPreference.authUserId, scheduled.person.account.id))
	)[0]?.favorite,
	false,
);
checks++;
const { default: api } = await import("../src/services/api");
api.compile();
const { auth } = await import("../src/services/auth");
const { serializeSignedCookie } = await import("better-call");
const http = await database.transaction(async (tx) => {
	const person = await actor(tx, "Following HTTP owner"),
		operator = await actor(tx, "Following HTTP moderator"),
		resource = await targetPost(tx);
	const basis = await ruleBasis(tx, operator);
	await tx.insert(platformCapabilityGrant).values({
		authUserId: operator.account.id,
		capability: "platform.user.status.update",
		grantedByAuthUserId: operator.account.id,
	});
	return { person, operator, resource, basis };
});
const authContext = await auth.$context,
	session = await authContext.internalAdapter.createSession(http.person.account.id);
let [cookie] = (
	await serializeSignedCookie(
		authContext.authCookies.sessionToken.name,
		session.token,
		authContext.secret,
		{ path: "/" },
	)
).split(";");
assert.ok(cookie);
let httpChecks = 0;
async function request(
	method: string,
	path: string,
	status: number,
	body?: unknown,
	signed = true,
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/account/me/following${path}`, {
			method,
			headers: {
				...(signed ? { Cookie: cookie! } : {}),
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			...(body ? { body: JSON.stringify(body) } : {}),
		}),
	);
	const text = await response.text();
	assert.equal(response.status, status, text);
	const value = JSON.parse(text);
	httpChecks++;
	return value;
}
const route = `/${http.resource.id}`;
await request("GET", route, 401, undefined, false);
assert.equal((await request("GET", route, 200)).following, false);
checks++;
assert.equal((await request("PUT", route, 200)).following, true);
checks++;
assert.equal((await request("GET", route, 200)).following, true);
checks++;
assert.equal((await request("PATCH", route, 200, { favorite: true })).favorite, true);
checks++;
assert.equal(
	(
		await request("PUT", `${route}/settings`, 200, {
			owner: "post",
			inAppNotificationsEnabled: false,
			realmTagSourceSubscribed: null,
		})
	).inAppNotificationsEnabled,
	false,
);
checks++;
assert.equal((await request("GET", "?limit=10", 200)).items[0]?.id, http.resource.id);
checks++;
await request("PUT", `${route}/settings`, 409, {
	owner: "realm",
	inAppNotificationsEnabled: false,
	realmTagSourceSubscribed: false,
});
assert.equal((await request("DELETE", route, 200)).following, false);
checks++;
assert.equal((await request("GET", route, 200)).following, false);
checks++;
await replacePlatformUserAccountState({
	authorization: http.operator.authorization,
	targetUserId: http.person.account.id,
	command: { state: "suspended", expectedRevision: 0, rules: [http.basis] },
});
assert.equal((await request("GET", route, 401)).error.code, "AuthenticationRequired");
checks++;
await replacePlatformUserAccountState({
	authorization: http.operator.authorization,
	targetUserId: http.person.account.id,
	command: { state: "active", expectedRevision: 1, rules: [http.basis] },
});
const restoredSession = await authContext.internalAdapter.createSession(http.person.account.id);
[cookie] = (
	await serializeSignedCookie(
		authContext.authCookies.sessionToken.name,
		restoredSession.token,
		authContext.secret,
		{ path: "/" },
	)
).split(";");
assert.ok(cookie);
assert.equal((await request("GET", route, 200)).following, false);
checks++;

await replacePlatformUserAccountState({
	authorization: http.operator.authorization,
	targetUserId: http.person.account.id,
	command: { state: "closed", expectedRevision: 2, rules: [http.basis] },
});
assert.equal((await request("GET", "?limit=10", 401)).error.code, "AuthenticationRequired");
checks++;
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-following-authority.ts",
	"services/main/src/services/following/service.ts",
	"services/main/src/services/api/users/index.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		checks,
		httpChecks,
		currentSelfRequired: true,
		accountStatesQualified: true,
		contributionVsPrivateWriteQualified: true,
		orderedRaces: 4,
		scheduledRestrictionRecheckedAfterWait: true,
		expiryRecheckedAfterWait: true,
		transactionCasesRolledBack: true,
		raceFixturesRetained: true,
	}),
);
await database.$client.end();
await observability.shutdown();
