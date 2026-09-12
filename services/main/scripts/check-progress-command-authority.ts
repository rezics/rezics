import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createManagedOrganization } from "../src/services/participation/organizations";
import { setTimeout } from "node:timers/promises";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
import { UnitNotFound } from "../src/services/units/errors";
import { publishingIdentity } from "../src/services/database/schema/catalog-identity";
import { issueParticipationGrant } from "../src/services/participation/commands";
import assert from "node:assert/strict";
import { initializeObservability } from "@rezics/observability";
import { desc, eq, sql } from "drizzle-orm";
import { OfficialRealmUnitIds } from "@rezics/slug";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	authEntity,
	unitProgress,
	unitProgressEntry,
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
import {
	AccountClosed,
	AccountSuspended,
	EmailVerificationRequired,
} from "../src/services/auth/errors";
import { AccountRestricted } from "../src/services/authorization/errors";
import { replacePlatformUserAccountState } from "../src/services/platform-users/service";
import { createGovernanceDecision } from "../src/services/governance/decision-service";
import { createCatalogIdentity } from "../src/services/catalog/storage";
import { withProgressWriteAuthority } from "../src/services/api/progress/authority";
import { createProgressEntry } from "../src/services/api/progress/service";
const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
);
const observability = initializeObservability({
	service: { name: "progress-command-authority-fixture", version: "1", environment: "tooling" },
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
async function write(person: Actor, unitId: string) {
	return withProgressWriteAuthority(
		{ authUserId: person.account.id, unitId, authorization: person.authorization },
		(tx) =>
			createProgressEntry(tx, person.account.id, unitId, {
				entryKind: "update",
				status: "active",
				progress: 0.3,
				occurredAt: new Date(),
				datePrecision: "instant",
				affectsCurrent: true,
			}),
	);
}
const rollback = new Error("rollback Progress command authority");
try {
	await withDatabaseTransactionDeadline(60000, () =>
		database.transaction(async (tx) => {
			const person = await actor(tx, "Progress command owner"),
				operator = await actor(tx, "Progress command moderator");
			const resource = await runWithParticipationAuthority(operator.authority, () =>
				createCatalogIdentity(
					tx,
					{ owner: "publishing", shape: "work", visibility: "public", status: "published" },
					operator.account.id,
				),
			);
			await tx.update(users).set({ emailVerified: false }).where(eq(users.id, person.account.id));
			await assert.rejects(
				tx.transaction(() => write(person, resource.id)),
				EmailVerificationRequired,
			);
			checks++;
			await tx.update(users).set({ emailVerified: true }).where(eq(users.id, person.account.id));
			await write(person, resource.id);
			assert.equal(
				(await tx.select().from(unitProgress).where(eq(unitProgress.authUserId, person.account.id)))
					.length,
				1,
			);
			checks++;
			const organization = await runWithParticipationAuthority(person.authority, () =>
				createManagedOrganization(tx, person.authority, {
					name: "Progress organization",
					language: "en",
				}),
			);
			const grant = organization.grants.find((value) => value.capability === "entity.security");
			assert.ok(grant);
			const organizationEntry = await write(
				{
					...person,
					authorization: new Authorization(person.self.id, person.account.id, {
						...person.authority,
						actingEntityId: organization.entityId,
						grant: { id: grant.id, revision: grant.revision },
					}),
				},
				resource.id,
			);
			assert.equal(organizationEntry.authUserId, person.account.id);
			checks++;
			const entriesBeforeStale = (
				await tx
					.select()
					.from(unitProgressEntry)
					.where(eq(unitProgressEntry.authUserId, person.account.id))
			).length;
			await tx
				.update(authEntity)
				.set({ revision: sql`${authEntity.revision}+1` })
				.where(eq(authEntity.authUserId, person.account.id));
			await assert.rejects(
				tx.transaction(() => write(person, resource.id)),
				ParticipationDenied,
			);
			checks++;
			assert.equal(
				(
					await tx
						.select()
						.from(unitProgressEntry)
						.where(eq(unitProgressEntry.authUserId, person.account.id))
				).length,
				entriesBeforeStale,
			);
			checks++;
			const fresh = {
				...person,
				authorization: new Authorization(person.self.id, person.account.id, {
					...person.authority,
					authorizationRevision: person.authority.authorizationRevision + 1,
				}),
			};
			await write(fresh, resource.id);
			checks++;
			await assert.rejects(
				tx.transaction(() =>
					write({ ...fresh, authorization: operator.authorization }, resource.id),
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
			let revision = 0;
			for (const state of ["suspended", "active", "closed", "active"] as const) {
				await replacePlatformUserAccountState({
					authorization: operator.authorization,
					targetUserId: person.account.id,
					command: { state, expectedRevision: revision++, rules: [basis] },
				});
				if (state === "active") await write(fresh, resource.id);
				else
					await assert.rejects(
						tx.transaction(() => write(fresh, resource.id)),
						state === "suspended" ? AccountSuspended : AccountClosed,
					);
				checks++;
			}
			for (const kind of ["ban", "suspension", "silence"] as const) {
				await assert.rejects(
					tx.transaction(async (nested) => {
						await restrict(nested, person, operator, kind);
						if (kind === "silence") await write(fresh, resource.id);
						else
							await assert.rejects(
								nested.transaction(() => write(fresh, resource.id)),
								AccountRestricted,
							);
						checks++;
						throw rollback;
					}),
					(e) => e === rollback,
				);
			}
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
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
	throw new Error("The exact Progress worker did not meet its holder");
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

async function fixture() {
	return database.transaction(async (tx) => {
		const person = await actor(tx, "Progress race"),
			operator = await actor(tx, "Progress race moderator");
		const resource = await runWithParticipationAuthority(operator.authority, () =>
			createCatalogIdentity(
				tx,
				{ owner: "publishing", shape: "work", status: "published", visibility: "public" },
				operator.account.id,
			),
		);
		return { person, operator, resource };
	});
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
				await tx
					.update(publishingIdentity)
					.set({ visibility: "private" })
					.where(eq(publishingIdentity.id, resource.id));
			}
		},
		() => write(person, resource.id),
		undefined,
		change === "self" ? ParticipationDenied : UnitNotFound,
	);
	assert.equal(
		(
			await database
				.select()
				.from(unitProgressEntry)
				.where(eq(unitProgressEntry.authUserId, person.account.id))
		).length,
		0,
	);
	checks++;
}
for (const change of ["expiry", "scheduled-ban"] as const) {
	const { person, operator, resource } = await fixture(),
		transitionAt = new Date(Date.now() + 2500);
	await database.transaction(async (tx) => {
		if (change === "expiry") {
			await tx
				.update(publishingIdentity)
				.set({ visibility: "private" })
				.where(eq(publishingIdentity.id, resource.id));
			const grant = await issueParticipationGrant(tx, operator.authority, {
				recipient: { kind: "auth", authUserId: person.account.id },
				actingEntityId: person.self.id,
				capability: "catalog.read",
				target: { owner: "publishing", id: resource.id },
				expiresAt: transitionAt,
			});
			person.authorization = new Authorization(person.self.id, person.account.id, {
				...person.authority,
				grant: { id: grant.id, revision: grant.revision },
			});
		} else await restrict(tx, person, operator, "ban", transitionAt);
	});
	await race(
		async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtextextended(${`unit-progress:${person.account.id}:${resource.id}`}::text,0))`,
			);
		},
		() => write(person, resource.id),
		async (tx) => {
			await tx.execute(
				sql`select pg_sleep(greatest(0,extract(epoch from ${transitionAt}::timestamptz-statement_timestamp()))+0.1)`,
			);
		},
		change === "expiry" ? ParticipationDenied : AccountRestricted,
	);
	assert.equal(
		(
			await database
				.select()
				.from(unitProgressEntry)
				.where(eq(unitProgressEntry.authUserId, person.account.id))
		).length,
		0,
	);
	checks++;
	assert.equal(
		(
			await database
				.select()
				.from(unitProgress)
				.where(eq(unitProgress.authUserId, person.account.id))
		).length,
		0,
	);
	checks++;
}
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-progress-command-authority.ts",
	"services/main/src/services/api/progress/authority.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(`../../../${path}`, import.meta.url)))
		.digest("hex");
console.info(
	JSON.stringify({
		checks,
		orderedRaces: 4,
		sourceDigests,
		transactionCasesRolledBack: true,
		raceFixturesRetained: true,
	}),
);

await database.$client.end();
await observability.shutdown();
