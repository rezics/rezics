import { createManagedOrganization } from "../src/services/participation/organizations";
import assert from "node:assert/strict";
import { initializeObservability } from "@rezics/observability";
import { desc, eq, sql } from "drizzle-orm";
import { setTimeout } from "node:timers/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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
	studioResourceVisit,
	unitAccessGrant,
	realm,
	realmRule,
	realmRuleRevision,
	platformCapabilityGrant,
	accountEnforcement,
	accountEnforcementAction,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import {
	ParticipationDenied,
	runWithParticipationAuthority,
} from "../src/services/participation/policy";
import { AccountClosed, AccountSuspended } from "../src/services/auth/errors";
import { AccountRestricted } from "../src/services/authorization/errors";
import { UnitNotFound } from "../src/services/units/errors";
import { replacePlatformUserAccountState } from "../src/services/platform-users/service";
import { createGovernanceDecision } from "../src/services/governance/decision-service";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
);
const observability = initializeObservability({
	service: { name: "studio-visit-authority-fixture", version: "1", environment: "tooling" },
});
let checks = 0;
const { recordStudioVisit } = await import("../src/services/studio/service");
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
	return { authUserId: person.account.id, unitId, authorization: person.authorization };
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
async function restrict(
	tx: DatabaseTransaction,
	person: Actor,
	operator: Actor,
	kind: "ban" | "suspension" | "silence",
	startsAt = new Date(),
) {
	await tx
		.select({ id: users.id })
		.from(users)
		.where(eq(users.id, person.account.id))
		.for("update");
	const basis = await ruleBasis(tx, operator);
	const decision = await createGovernanceDecision(tx, {
		action: "account.enforcement.create",
		actorProfileId: operator.self.id,
		authority: { kind: "platform" },
		targetUserId: person.account.id,
		subject: { kind: "auth", id: person.account.id },
		basis: { kind: "rules", rules: [basis] },
	});
	const [action] = await tx
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
	await tx
		.insert(accountEnforcement)
		.values({ authUserId: person.account.id, kind, decisionActionId: action.id, startsAt });
}
async function selectedOrganization(tx: DatabaseTransaction, person: Actor) {
	const organization = await runWithParticipationAuthority(person.authority, () =>
		createManagedOrganization(tx, person.authority, {
			name: "Studio organization",
			language: "en",
		}),
	);
	const grant = organization.grants.find((value) => value.capability === "entity.security");
	assert.ok(grant);
	return {
		...person.authority,
		actingEntityId: organization.entityId,
		grant: { id: grant.id, revision: grant.revision },
	};
}
async function visitRows(authUserId: string) {
	return database
		.select()
		.from(studioResourceVisit)
		.where(eq(studioResourceVisit.authUserId, authUserId));
}
const rollback = new Error("rollback Studio visit fixture");
try {
	await withDatabaseTransactionDeadline(60000, () =>
		database.transaction(async (tx) => {
			const person = await actor(tx, "Studio owner"),
				operator = await actor(tx, "Studio moderator");
			const resource = await targetPost(tx);
			const first = await recordStudioVisit(input(person, resource.id));
			const second = await recordStudioVisit(input(person, resource.id));
			assert.equal(first.unitId, resource.id);
			checks++;
			assert.ok(second.lastVisitedAt >= first.lastVisitedAt);
			checks++;
			assert.equal((await visitRows(person.account.id)).length, 1);
			checks++;
			await assert.rejects(
				tx.transaction(() =>
					recordStudioVisit({
						...input(person, resource.id),
						authorization: operator.authorization,
					}),
				),
				ParticipationDenied,
			);
			checks++;
			const wrongSelf = new Authorization(operator.self.id, person.account.id, person.authority);
			await assert.rejects(
				tx.transaction(() =>
					recordStudioVisit({ ...input(person, resource.id), authorization: wrongSelf }),
				),
				ParticipationDenied,
			);
			checks++;
			const organization = await selectedOrganization(tx, person);
			await recordStudioVisit({
				...input(person, resource.id),
				authorization: new Authorization(person.self.id, person.account.id, organization),
			});
			assert.equal((await visitRows(person.account.id)).length, 1);
			checks++;

			await tx
				.update(authEntity)
				.set({ revision: sql`${authEntity.revision}+1` })
				.where(eq(authEntity.authUserId, person.account.id));
			await assert.rejects(
				tx.transaction(() => recordStudioVisit(input(person, resource.id))),
				ParticipationDenied,
			);
			checks++;
			const fresh = {
				...person,
				authorization: new Authorization(person.self.id, person.account.id, {
					...person.authority,
					authorizationRevision: person.authority.authorizationRevision + 1,
				}),
			};
			await recordStudioVisit(input(fresh, resource.id));
			checks++;
			const basis = await ruleBasis(tx, operator);
			await tx.insert(platformCapabilityGrant).values({
				authUserId: operator.account.id,
				capability: "platform.user.status.update",
				grantedByAuthUserId: operator.account.id,
			});
			let revision = 0;
			for (const state of ["suspended", "active", "closed", "active"] as const) {
				await replacePlatformUserAccountState({
					authorization: operator.authorization,
					targetUserId: person.account.id,
					command: { state, expectedRevision: revision++, rules: [basis] },
				});
				if (state === "active") await recordStudioVisit(input(fresh, resource.id));
				else
					await assert.rejects(
						tx.transaction(() => recordStudioVisit(input(fresh, resource.id))),
						state === "suspended" ? AccountSuspended : AccountClosed,
					);
				checks++;
			}
			for (const kind of ["ban", "suspension", "silence"] as const) {
				await assert.rejects(
					tx.transaction(async (nested) => {
						await restrict(nested, person, operator, kind);
						if (kind === "silence") await recordStudioVisit(input(fresh, resource.id));
						else
							await assert.rejects(
								nested.transaction(() => recordStudioVisit(input(fresh, resource.id))),
								AccountRestricted,
							);
						checks++;
						throw rollback;
					}),
					(e) => e === rollback,
				);
			}
			const future = new Date(Date.now() + 60000);
			await tx
				.update(studioResourceVisit)
				.set({ lastVisitedAt: future })
				.where(eq(studioResourceVisit.authUserId, person.account.id));
			assert.equal(
				(await recordStudioVisit(input(fresh, resource.id))).lastVisitedAt.getTime(),
				future.getTime(),
			);
			checks++;
			await tx.update(post).set({ visibility: "private" }).where(eq(post.id, resource.id));
			await assert.rejects(
				tx.transaction(() => recordStudioVisit(input(fresh, resource.id))),
				UnitNotFound,
			);
			checks++;
			assert.equal(
				(await visitRows(person.account.id))[0]?.lastVisitedAt.getTime(),
				future.getTime(),
			);
			checks++;
			await assert.rejects(
				tx.transaction(() => recordStudioVisit(input(fresh, crypto.randomUUID()))),
				UnitNotFound,
			);
			checks++;
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}
async function fixture() {
	return database.transaction(async (tx) => ({
		person: await actor(tx, "Studio race"),
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
	throw new Error("The exact Studio visit worker did not meet its holder");
}
// Wait on an observed database blocker, never an assumed request scheduling order.
async function race<T>(
	hold: (tx: DatabaseTransaction) => Promise<void>,
	work: () => Promise<T>,
	afterObserved: (tx: DatabaseTransaction) => Promise<void> = async () => {},
	expected?: typeof ParticipationDenied | typeof UnitNotFound | typeof AccountRestricted,
) {
	const ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		started = Promise.withResolvers<number>();
	const holding = database.transaction(async (tx) => {
		await hold(tx);
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
		await afterObserved(tx);
	});
	void holding.catch(ready.reject);
	const holder = await ready.promise;
	const working = withDatabaseTransactionDeadline(10000, async () => {
		started.resolve(
			(await database.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return work();
	});
	void working.catch(started.reject);
	const result = expected ? assert.rejects(working, expected) : working;
	void result.catch(() => {});
	try {
		await observe(await started.promise, holder);
	} finally {
		release.resolve();
		await holding;
	}
	return result;
}
for (const change of ["self", "target"] as const) {
	const { person, resource } = await fixture();
	await race(
		async (tx) => {
			if (change === "self")
				await tx
					.update(authEntity)
					.set({ revision: sql`${authEntity.revision}+1` })
					.where(eq(authEntity.authUserId, person.account.id));
			else {
				await lockUnitAccessState(tx, [resource.id]);
				await tx.update(post).set({ visibility: "private" }).where(eq(post.id, resource.id));
			}
		},
		() => recordStudioVisit(input(person, resource.id)),
		undefined,
		change === "self" ? ParticipationDenied : UnitNotFound,
	);
	assert.equal((await visitRows(person.account.id)).length, 0);
	checks++;
}
for (const change of ["grant-expiry", "scheduled-ban", "completion-time"] as const) {
	const { person, resource } = await fixture();
	await recordStudioVisit(input(person, resource.id));
	const before = (await visitRows(person.account.id))[0]!.lastVisitedAt;
	const transitionAt = new Date(Date.now() + 2500);
	if (change === "grant-expiry")
		await database.transaction(async (tx) => {
			await tx.update(post).set({ visibility: "private" }).where(eq(post.id, resource.id));
			await tx.insert(unitAccessGrant).values({
				unitId: resource.id,
				subjectKind: "auth",
				authUserId: person.account.id,
				permission: "unit.read",
				scope: [],
				grantedByAuthUserId: person.account.id,
				expiresAt: transitionAt,
			});
		});
	if (change === "scheduled-ban")
		await database.transaction(async (tx) =>
			restrict(tx, person, await actor(tx, "Studio scheduled moderator"), "ban", transitionAt),
		);
	await race(
		async (tx) => {
			await tx
				.select()
				.from(studioResourceVisit)
				.where(eq(studioResourceVisit.authUserId, person.account.id))
				.for("update");
		},
		() => recordStudioVisit(input(person, resource.id)),
		async (tx) => {
			await tx.execute(
				sql`select pg_sleep(greatest(0,extract(epoch from ${transitionAt}::timestamptz-statement_timestamp()))+0.1)`,
			);
		},
		change === "grant-expiry"
			? UnitNotFound
			: change === "scheduled-ban"
				? AccountRestricted
				: undefined,
	);
	const after = (await visitRows(person.account.id))[0]!.lastVisitedAt;
	if (change === "completion-time")
		assert.ok(after >= transitionAt, "visit time must reflect completion after the row wait");
	else assert.equal(after.getTime(), before.getTime(), "denied visit rolls back timestamp");
	checks++;
}
const { default: api } = await import("../src/services/api");
api.compile();
const { auth } = await import("../src/services/auth");
const { serializeSignedCookie } = await import("better-call");
const http = await database.transaction(async (tx) => {
	const person = await actor(tx, "Studio HTTP owner"),
		operator = await actor(tx, "Studio HTTP moderator"),
		resource = await targetPost(tx);
	const basis = await ruleBasis(tx, operator);
	await tx.insert(platformCapabilityGrant).values({
		authUserId: operator.account.id,
		capability: "platform.user.status.update",
		grantedByAuthUserId: operator.account.id,
	});
	return {
		person,
		operator,
		resource,
		basis,
		organization: await selectedOrganization(tx, person),
	};
});
const authContext = await auth.$context;
async function sessionCookie() {
	const session = await authContext.internalAdapter.createSession(http.person.account.id);
	return (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";")[0]!;
}
let cookie = await sessionCookie(),
	httpChecks = 0;
async function request(unitId: string, status: number, signed = true, selected = false) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/account/me/studio/${unitId}/visit`, {
			method: "PUT",
			headers: signed
				? {
						Cookie: cookie,
						...(selected
							? {
									"X-Rezics-Participation": JSON.stringify({
										actingEntityId: http.organization.actingEntityId,
										grant: http.organization.grant,
									}),
								}
							: {}),
					}
				: {},
		}),
	);
	const text = await response.text();
	assert.equal(response.status, status, text);
	httpChecks++;
	return JSON.parse(text);
}
await request(http.resource.id, 401, false);
const first = await request(http.resource.id, 200),
	second = await request(http.resource.id, 200);
await request(http.resource.id, 200, true, true);
assert.equal(first.unitId, http.resource.id);
checks++;
assert.ok(new Date(second.lastVisitedAt) >= new Date(first.lastVisitedAt));
checks++;
assert.equal((await visitRows(http.person.account.id)).length, 1);
checks++;
await database.update(post).set({ visibility: "private" }).where(eq(post.id, http.resource.id));
assert.equal((await request(http.resource.id, 404)).error.code, "UnitNotFound");
checks++;
await database.update(post).set({ visibility: "public" }).where(eq(post.id, http.resource.id));
assert.equal((await request(crypto.randomUUID(), 404)).error.code, "UnitNotFound");
checks++;
let stateRevision = 0;
for (const state of ["suspended", "active", "closed", "active"] as const) {
	await replacePlatformUserAccountState({
		authorization: http.operator.authorization,
		targetUserId: http.person.account.id,
		command: { state, expectedRevision: stateRevision++, rules: [http.basis] },
	});
	if (state === "active") {
		cookie = await sessionCookie();
		await request(http.resource.id, 200);
	} else assert.equal((await request(http.resource.id, 401)).error.code, "AuthenticationRequired");
	checks++;
}
await database.transaction((tx) => restrict(tx, http.person, http.operator, "ban"));
assert.equal((await request(http.resource.id, 403)).error.code, "AccountRestricted");
checks++;
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-studio-visit-authority.ts",
	"services/main/src/services/studio/service.ts",
	"services/main/src/services/api/users/index.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(`../../../${path}`, import.meta.url)))
		.digest("hex");
console.info(
	JSON.stringify({
		checks,
		httpChecks,
		orderedRaces: 5,
		sourceDigests,
		transactionCasesRolledBack: true,
		raceFixturesRetained: true,
	}),
);
await database.$client.end();
await observability.shutdown();
