import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { AccountRestricted } from "../src/services/authorization/errors";
import { createGovernanceDecision } from "../src/services/governance/decision-service";
import {
	realm,
	realmRule,
	realmRuleRevision,
	accountEnforcement,
	accountEnforcementAction,
} from "../src/services/database/schema";
import { EmailVerificationRequired } from "../src/services/auth/errors";
import { lockUnitStatusTransition } from "../src/services/units/status";
import { readUnitStateById } from "../src/services/units/query";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { and, desc, eq, sql } from "drizzle-orm";
import Elysia from "elysia";
import { initializeObservability } from "@rezics/observability";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	authEntity,
	post,
	unitLocalization,
	unitOwnership,
	unitAccessGrant,
	collectionItem,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import {
	runWithParticipationAuthority,
	ParticipationDenied,
} from "../src/services/participation/policy";
import { insertPlatformUnit } from "../src/services/units/create";
import { recordUnitRevision } from "../src/services/units/history";
import {
	createCollectionStructureHistory,
	getCollectionStructureRevisionState,
	restoreCollectionStructureRevision,
} from "../src/services/collection-structure/history";
import { applyCollectionBatch } from "../src/services/collection-structure/batch";
import {
	withCollectionAuthority,
	withCollectionCreationAuthority,
} from "../src/services/collection-structure/authority";
const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
);
const observability = initializeObservability({
	service: { name: "collection-authority-fixture", version: "1", environment: "tooling" },
});
const { default: routes } = await import("../src/services/api/collections");
const { default: errors } = await import("../src/services/api/error-boundary");
const { auth } = await import("../src/services/auth");
const { serializeSignedCookie } = await import("better-call");
const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(routes);
api.compile();
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
const fixture = await withDatabaseTransactionDeadline(60000, () =>
	database.transaction(async (tx) => {
		const owner = await actor(tx, "Collection owner"),
			editor = await actor(tx, "Collection editor"),
			observer = await actor(tx, "Collection reader");
		return runWithParticipationAuthority(owner.authority, async () => {
			const collection = await insertPlatformUnit(tx, {
				owner: "collection",
				values: {
					createdByAuthUserId: owner.account.id,
					status: "published",
					visibility: "public",
					publishedAt: new Date(),
				},
				statusActor: { kind: "profile", profileId: owner.self.id },
			});
			await tx.insert(unitOwnership).values({
				unitId: collection.id,
				profileId: owner.self.id,
				assignedByProfileId: owner.self.id,
			});
			await tx
				.insert(unitLocalization)
				.values({ unitId: collection.id, language: "en", title: "Private curation history" });
			await recordUnitRevision(tx, {
				unitId: collection.id,
				actorProfileId: owner.self.id,
				event: "create",
			});
			const initial = await createCollectionStructureHistory(tx, {
				collectionId: collection.id,
				actorProfileId: owner.self.id,
			});
			const [privateTarget, publicTarget] = await tx
				.insert(post)
				.values([
					{
						visibility: "private",
						status: "published",
						publishedAt: new Date(),
						createdByAuthUserId: owner.account.id,
					},
					{
						visibility: "public",
						status: "published",
						publishedAt: new Date(),
						createdByAuthUserId: owner.account.id,
					},
				])
				.returning();
			assert.ok(privateTarget && publicTarget);
			await tx.insert(unitOwnership).values({
				unitId: privateTarget.id,
				profileId: owner.self.id,
				assignedByProfileId: owner.self.id,
			});
			const added = await applyCollectionBatch(tx, {
				collectionId: collection.id,
				actorProfileId: owner.self.id,
				baseRevisionId: initial.revisionId,
				commands: [{ opId: "private", type: "item.add", targetId: privateTarget.id }],
				ensureTargetReadable: async (id) => {
					await owner.authorization.unit.ensureInTransaction(tx, id, "unit.read");
				},
				errors: { invalid: (message) => new Error(message) },
			});
			const [grant] = await tx
				.insert(unitAccessGrant)
				.values({
					unitId: collection.id,
					subjectKind: "auth",
					authUserId: editor.account.id,
					permission: "unit.update",
					scope: [],
					grantedByAuthUserId: owner.account.id,
				})
				.returning();
			assert.ok(grant);
			return {
				owner,
				editor,
				observer,
				collection,
				initial,
				added,
				privateTarget,
				publicTarget,
				grant,
			};
		});
	}),
);
let checks = 0;
await assert.rejects(
	() =>
		withCollectionAuthority(
			{
				collectionId: fixture.collection.id,
				authorization: new Authorization(undefined),
				mode: "history",
			},
			(tx) =>
				getCollectionStructureRevisionState(tx, {
					collectionId: fixture.collection.id,
					revisionId: fixture.added.revisionId,
				}),
		),
	ParticipationDenied,
);
checks++;
for (const person of [fixture.owner, fixture.editor]) {
	const history = await withCollectionAuthority(
		{ collectionId: fixture.collection.id, authorization: person.authorization, mode: "history" },
		(tx) =>
			getCollectionStructureRevisionState(tx, {
				collectionId: fixture.collection.id,
				revisionId: fixture.added.revisionId,
			}),
	);
	assert.equal(history.items[0]?.targetUnitId, fixture.privateTarget.id);
	checks++;
}
const rollback = new Error("rollback Collection command cases");
try {
	await withDatabaseTransactionDeadline(60000, () =>
		database.transaction(async (tx) => {
			const added = await withCollectionAuthority(
				{
					collectionId: fixture.collection.id,
					authorization: fixture.editor.authorization,
					mode: "items",
				},
				(inner) =>
					applyCollectionBatch(inner, {
						collectionId: fixture.collection.id,
						actorProfileId: fixture.editor.self.id,
						baseRevisionId: fixture.added.revisionId,
						commands: [{ opId: "public", type: "item.add", targetId: fixture.publicTarget.id }],
						ensureTargetReadable: async (id) => {
							await fixture.editor.authorization.unit.ensureInTransaction(inner, id, "unit.read");
						},
						errors: { invalid: (message) => new Error(message) },
					}),
			);
			assert.equal(
				(
					await tx
						.select()
						.from(collectionItem)
						.where(eq(collectionItem.collectionId, fixture.collection.id))
				).length,
				2,
			);
			checks++;
			await withCollectionAuthority(
				{
					collectionId: fixture.collection.id,
					authorization: fixture.owner.authorization,
					mode: "restore",
				},
				(inner) =>
					restoreCollectionStructureRevision(inner, {
						collectionId: fixture.collection.id,
						sourceRevisionId: fixture.added.revisionId,
						baseRevisionId: added.revisionId,
						actorProfileId: fixture.owner.self.id,
					}),
			);
			assert.equal(
				(
					await tx
						.select()
						.from(collectionItem)
						.where(eq(collectionItem.collectionId, fixture.collection.id))
				).length,
				1,
			);
			checks++;
			await tx
				.update(users)
				.set({ emailVerified: false })
				.where(eq(users.id, fixture.owner.account.id));
			await assert.rejects(
				() =>
					withCollectionCreationAuthority(fixture.owner.authorization, async () => {
						assert.fail("Unverified creation must not run");
					}),
				EmailVerificationRequired,
			);
			checks++;
			await withCollectionAuthority(
				{
					collectionId: fixture.collection.id,
					authorization: fixture.owner.authorization,
					mode: "history",
				},
				(inner) =>
					getCollectionStructureRevisionState(inner, {
						collectionId: fixture.collection.id,
						revisionId: fixture.added.revisionId,
					}),
			);
			checks++;
			await tx
				.update(users)
				.set({ emailVerified: true })
				.where(eq(users.id, fixture.owner.account.id));
			const undoBan = new Error("rollback Collection ban");
			await assert.rejects(
				tx.transaction(async (nested) => {
					await restrict(nested, fixture.owner, fixture.editor, "ban");
					await withCollectionAuthority(
						{
							collectionId: fixture.collection.id,
							authorization: fixture.owner.authorization,
							mode: "history",
						},
						(inner) =>
							getCollectionStructureRevisionState(inner, {
								collectionId: fixture.collection.id,
								revisionId: fixture.added.revisionId,
							}),
					);
					checks++;
					for (const mode of ["items", "metadata", "restore"] as const) {
						await assert.rejects(
							() =>
								withCollectionAuthority(
									{
										collectionId: fixture.collection.id,
										authorization: fixture.owner.authorization,
										mode,
									},
									async () => {
										assert.fail("Banned writes must not run");
									},
								),
							AccountRestricted,
						);
						checks++;
					}
					await assert.rejects(
						() =>
							withCollectionCreationAuthority(fixture.owner.authorization, async () => {
								assert.fail("Banned creation must not run");
							}),
						AccountRestricted,
					);
					checks++;
					throw undoBan;
				}),
				(error) => error === undoBan,
			);
			await tx
				.update(authEntity)
				.set({ revision: sql`${authEntity.revision}+1` })
				.where(eq(authEntity.authUserId, fixture.owner.account.id));
			for (const mode of ["history", "items", "metadata", "restore"] as const) {
				await assert.rejects(
					() =>
						withCollectionAuthority(
							{
								collectionId: fixture.collection.id,
								authorization: fixture.owner.authorization,
								mode,
							},
							async () => {
								assert.fail("Stale Self must not run");
							},
						),
					ParticipationDenied,
				);
				checks++;
			}
			await assert.rejects(
				() =>
					withCollectionCreationAuthority(fixture.owner.authorization, async () => {
						assert.fail("Stale Self creation must not run");
					}),
				ParticipationDenied,
			);
			checks++;
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}
console.info(JSON.stringify({ checks, commandCasesRolledBack: true }));
const context = await auth.$context,
	session = await context.internalAdapter.createSession(fixture.editor.account.id);
const [cookie] = (
	await serializeSignedCookie(
		context.authCookies.sessionToken.name,
		session.token,
		context.secret,
		{ path: "/" },
	)
).split(";");
assert.ok(cookie);
const history = await api.fetch(
	new Request(
		`http://localhost:3001/api/v1/collections/${fixture.collection.id}/item-revisions/compare?from=${fixture.initial.revisionId}&to=${fixture.added.revisionId}`,
	),
);
const historyBody = await history.text();
const expiresAt = new Date(Date.now() + 3000);
await database
	.update(unitAccessGrant)
	.set({ expiresAt })
	.where(eq(unitAccessGrant.id, fixture.grant.id));
const ready = Promise.withResolvers<number>(),
	release = Promise.withResolvers<void>();
const holding = database.transaction(async (tx) => {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${`collection-structure:${fixture.collection.id}`}::text,0))`,
	);
	ready.resolve(
		(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	await release.promise;
	await tx.execute(
		sql`select pg_sleep(greatest(0,extract(epoch from ${expiresAt}::timestamptz-clock_timestamp()))+0.1)`,
	);
});
void holding.catch(ready.reject);
const holder = await ready.promise;
const writing = Promise.resolve(
	api.fetch(
		new Request(
			`http://localhost:3001/api/v1/collections/${fixture.collection.id}/items/${fixture.publicTarget.id}`,
			{
				method: "PUT",
				headers: { Cookie: cookie, "Content-Type": "application/json" },
				body: JSON.stringify({ baseItemsRevisionId: fixture.added.revisionId }),
			},
		),
	),
);
void writing.catch(() => {});
let observed = false;
try {
	for (let attempt = 0; attempt < 500; attempt++) {
		if (
			(
				await database.execute(
					sql`select pid from pg_stat_activity where ${holder}=any(pg_blocking_pids(pid))`,
				)
			).rows.length === 1
		) {
			observed = true;
			break;
		}
		await setTimeout(10);
	}
	assert.ok(observed, "Collection writer must reach its exact history lock");
} finally {
	release.resolve();
	await holding;
}
const written = await writing;
const writtenBody = await written.text();
const rows = await database
	.select()
	.from(collectionItem)
	.where(
		and(
			eq(collectionItem.collectionId, fixture.collection.id),
			eq(collectionItem.unitId, fixture.publicTarget.id),
		),
	);
console.info(
	JSON.stringify({
		historyStatus: history.status,
		historyDisclosesPrivateId: historyBody.includes(fixture.privateTarget.id),
		writeStatus: written.status,
		writeBody: writtenBody,
		rowsAdded: rows.length,
		observed,
	}),
);
assert.equal(
	history.status,
	403,
	"Public Collection readability must not disclose private curation history",
);
assert.equal(
	written.status,
	403,
	"An expired edit grant must not authorize a queued membership write",
);
assert.equal(rows.length, 0);
checks += 3;
let httpChecks = 2;
async function signedCookie(authUserId: string) {
	const session = await context.internalAdapter.createSession(authUserId);
	const [cookie] = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			session.token,
			context.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return cookie;
}
const ownerCookie = await signedCookie(fixture.owner.account.id);
async function call(
	method: string,
	path: string,
	status: number,
	body?: unknown,
	cookieValue?: string,
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/collections${path}`, {
			method,
			headers: {
				...(cookieValue ? { Cookie: cookieValue } : {}),
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			...(body ? { body: JSON.stringify(body) } : {}),
		}),
	);
	const text = await response.text();
	assert.equal(response.status, status, text);
	httpChecks++;
	return text ? JSON.parse(text) : undefined;
}
const root = `/${fixture.collection.id}`;
assert.equal((await call("GET", root, 200)).capabilities.canViewHistory, false);
checks++;
await call("GET", `${root}/item-revisions`, 403);
await database.transaction(async (tx) => {
	await lockUnitAccessState(tx, [fixture.collection.id]);
	await tx
		.update(unitAccessGrant)
		.set({ expiresAt: null })
		.where(eq(unitAccessGrant.id, fixture.grant.id));
});
assert.equal((await call("GET", root, 200, undefined, cookie)).capabilities.canViewHistory, true);
checks++;
const observerCookie = await signedCookie(fixture.observer.account.id);
assert.equal(
	(await call("GET", root, 200, undefined, observerCookie)).capabilities.canViewHistory,
	false,
);
checks++;
await call("GET", `${root}/item-revisions`, 403, undefined, observerCookie);
const comparison = await call(
	"GET",
	`${root}/item-revisions/compare?from=${fixture.initial.revisionId}&to=${fixture.added.revisionId}`,
	200,
	undefined,
	cookie,
);
assert.ok(JSON.stringify(comparison.changes).includes(fixture.privateTarget.id));
checks++;
const saved = await call(
	"PUT",
	`${root}/items/${fixture.publicTarget.id}`,
	200,
	{ baseItemsRevisionId: fixture.added.revisionId },
	cookie,
);
await call(
	"PUT",
	`${root}/items/${fixture.publicTarget.id}`,
	409,
	{ baseItemsRevisionId: fixture.added.revisionId },
	cookie,
);
await call(
	"POST",
	`${root}/item-revisions/${fixture.added.revisionId}/restore`,
	403,
	{ baseItemsRevisionId: saved.latestItemsRevisionId },
	cookie,
);
const restored = await call(
	"POST",
	`${root}/item-revisions/${fixture.added.revisionId}/restore`,
	200,
	{ baseItemsRevisionId: saved.latestItemsRevisionId },
	ownerCookie,
);
assert.ok(restored.latestItemsRevisionId);
checks++;
const current = await call("GET", root, 200, undefined, cookie);
const edited = await call(
	"PATCH",
	root,
	200,
	{
		baseRevisionId: current.latestRevisionId,
		status: "published",
		visibility: "public",
		localization: { language: "en", title: "Updated curation" },
	},
	cookie,
);
await call(
	"PATCH",
	root,
	403,
	{
		baseRevisionId: edited.latestRevisionId,
		status: "draft",
		localization: { language: "en", title: "Must not be saved" },
	},
	cookie,
);
assert.equal((await call("GET", root, 200)).localizations[0].title, "Updated curation");
checks++;
const draft = await call(
	"PATCH",
	root,
	200,
	{ baseRevisionId: edited.latestRevisionId, status: "draft" },
	ownerCookie,
);
await call(
	"PATCH",
	root,
	200,
	{ baseRevisionId: draft.latestRevisionId, status: "published" },
	ownerCookie,
);
// Two Collections may refer to each other without requesting incompatible parent/FK row locks.
const pair: { id: string; latestItemsRevisionId: string }[] = [];
for (const title of ["Collection reference A", "Collection reference B"]) {
	const created = await call(
		"POST",
		"",
		200,
		{ localization: { language: "en", title }, visibility: "public" },
		ownerCookie,
	);
	assert.equal(typeof created.id, "string");
	assert.equal(typeof created.latestItemsRevisionId, "string");
	pair.push({ id: created.id, latestItemsRevisionId: created.latestItemsRevisionId });
}
const bothReady = Promise.withResolvers<void>();
let admitted = 0;
await Promise.all(
	pair.map((parent, index) =>
		withDatabaseTransactionDeadline(10000, () =>
			withCollectionAuthority(
				{ collectionId: parent.id, authorization: fixture.owner.authorization, mode: "items" },
				async (tx) => {
					if (++admitted === 2) bothReady.resolve();
					await bothReady.promise;
					return applyCollectionBatch(tx, {
						collectionId: parent.id,
						actorProfileId: fixture.owner.self.id,
						baseRevisionId: parent.latestItemsRevisionId,
						commands: [{ opId: "peer", type: "item.add", targetId: pair[1 - index]!.id }],
						ensureTargetReadable: async (id) => {
							await fixture.owner.authorization.unit.ensureInTransaction(tx, id, "unit.read");
						},
						errors: { invalid: (message) => new Error(message) },
					});
				},
			),
		),
	),
);
for (const parent of pair) {
	assert.equal(
		(await database.select().from(collectionItem).where(eq(collectionItem.collectionId, parent.id)))
			.length,
		1,
	);
	checks++;
}
// A status worker's lock precedes the parent row, including metadata edits that repeat status.
const beforeMetadata = await call("GET", root, 200, undefined, ownerCookie);
const statusReady = Promise.withResolvers<number>(),
	probeRow = Promise.withResolvers<void>();
const statusHolder = database.transaction(async (tx) => {
	await lockUnitStatusTransition(tx, fixture.collection.id);
	statusReady.resolve(
		(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
	);
	await probeRow.promise;
	await tx.execute(sql`set local lock_timeout='2s'`);
	assert.ok(await readUnitStateById(tx, fixture.collection.id, { lock: "update" }));
});
void statusHolder.catch(statusReady.reject);
const statusPid = await statusReady.promise;
const metadataWrite = call(
	"PATCH",
	root,
	200,
	{
		baseRevisionId: beforeMetadata.latestRevisionId,
		status: "published",
		localization: { language: "en", title: "Ordered metadata" },
	},
	ownerCookie,
);
void metadataWrite.catch(() => {});
let statusObserved = false;
try {
	for (let attempt = 0; attempt < 300; attempt++) {
		if (
			(
				await database.execute(
					sql`select pid from pg_stat_activity where ${statusPid}=any(pg_blocking_pids(pid))`,
				)
			).rows.length === 1
		) {
			statusObserved = true;
			break;
		}
		await setTimeout(10);
	}
	assert.ok(statusObserved);
} finally {
	probeRow.resolve();
	await statusHolder;
}
await metadataWrite;
checks++;
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-collection-authority.ts",
	"services/main/src/services/collection-structure/authority.ts",
	"services/main/src/services/api/collections/index.ts",
	"services/main/src/services/api/collections/service.ts",
	"services/main/src/services/units/status.ts",
	"services/main/src/services/units/query.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(`../../../${path}`, import.meta.url)))
		.digest("hex");
console.info(
	JSON.stringify({
		checks,
		httpChecks,
		expiredGrantRace: true,
		reciprocalReferenceRace: true,
		statusLockOrderRace: true,
		sourceDigests,
	}),
);
await database.$client.end();
await observability.shutdown();
