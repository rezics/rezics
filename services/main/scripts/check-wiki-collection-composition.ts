import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import Elysia from "elysia";
import { setImmediate, setTimeout } from "node:timers/promises";
import { withdrawUnitRealmPublication } from "../src/services/units/realm-publication";
import { InvalidPaginationCursor } from "../src/services/pagination/errors";
import assert from "node:assert/strict";
import { and, eq, inArray, sql } from "drizzle-orm";
import { initializeObservability } from "@rezics/observability";
import {
	assertResolvedBlockReferences,
	createZoneAppearanceDocument,
	type UnitReferencedBlockDocument,
} from "@rezics/block";
import { database, withDatabaseTransactionDeadline } from "../src/services/database";
import {
	users,
	unitLocalization,
	unitOwnership,
	post,
	collectionItem,
	realmUnit,
	unitAccessGrant,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { runWithParticipationAuthority } from "../src/services/participation/policy";
import { insertPlatformUnit } from "../src/services/units/create";
import { recordUnitRevision } from "../src/services/units/history";
import { createCollectionStructureHistory } from "../src/services/collection-structure/history";
import { applyCollectionBatch } from "../src/services/collection-structure/batch";
import { createWikiPost } from "../src/services/posts/wiki";
import { createUnitBlockReferenceResolver } from "../src/services/blocks/reference-resolver";
import { provisionZoneDefaultExperienceInTransaction } from "../src/services/zones/default-experience";
import { upsertZonePageUnit } from "../src/services/zones/pages";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
		url.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname),
);
const observability = initializeObservability({
	service: { name: "wiki-collection-composition-fixture", version: "1", environment: "tooling" },
});
const { getCollectionContent } = await import("../src/services/api/collections/service");
const { loadZonePageExecutionSurface, selectZonePageBlockExecutions, executeZonePageAggregate } =
	await import("../src/services/api/search/zone-page-execution");
let checks = 0;
let httpChecks = 0;
let overlappingQueries = 0;
process.on("warning", (warning) => {
	if (warning.message.includes("client.query()")) overlappingQueries++;
});
const check = (actual: unknown, expected: unknown, message: string) => {
	assert.deepEqual(actual, expected, message);
	checks++;
};
const fixture = await withDatabaseTransactionDeadline(60000, () =>
	database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({
				name: "Wiki collection curator",
				email: `${crypto.randomUUID()}@example.invalid`,
				emailVerified: true,
			})
			.returning();
		assert.ok(account);
		const authUserId = account.id;
		const self = await ensureSelfEntityInTransaction(tx, account);
		const authority = {
			principal: { kind: "auth" as const, authUserId: authUserId },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		};
		const authorization = new Authorization(self.id, authUserId, authority);
		return runWithParticipationAuthority(authority, async () => {
			async function resource(owner: "collection" | "realm" | "zone", title: string) {
				const values = {
					status: "published" as const,
					visibility: "public" as const,
					publishedAt: new Date(),
					createdByAuthUserId: authUserId,
				};
				const statusActor = { kind: "profile" as const, profileId: self.id };
				const created =
					owner === "zone"
						? await insertPlatformUnit(tx, {
								owner,
								values: {
									...values,
									filterDocument: {},
									appearanceDocument: createZoneAppearanceDocument({ accent: "#2563eb" }),
								},
								statusActor,
							})
						: owner === "realm"
							? await insertPlatformUnit(tx, { owner, values, statusActor })
							: await insertPlatformUnit(tx, { owner, values, statusActor });
				await tx
					.insert(unitOwnership)
					.values({ unitId: created.id, profileId: self.id, assignedByProfileId: self.id });
				await tx.insert(unitLocalization).values({ unitId: created.id, language: "en", title });
				await recordUnitRevision(tx, {
					unitId: created.id,
					actorProfileId: self.id,
					event: "create",
				});
				return created;
			}
			const community = await resource("realm", "Minecraft wiki community");
			async function wiki(title: string) {
				await authorization.realm.ensureUnitCreationInTransaction(
					tx,
					[community.id],
					"realm.units.create",
				);
				return createWikiPost(tx, {
					profileId: self.id,
					authorization,
					accessMode: "restricted",
					title,
					language: "en",
					body: { _type: "portable-text", _key: "000000000001", content: [] },
					publishRealmIds: [community.id],
				});
			}
			const article = await wiki("Minecraft wiki article"),
				modArticle = await wiki("Minecraft modding article"),
				hiddenArticle = await wiki("Private wiki draft");
			await tx.update(post).set({ visibility: "private" }).where(eq(post.id, hiddenArticle.id));
			async function curated(title: string, ids: string[]) {
				const collection = await resource("collection", title);
				const initial = await createCollectionStructureHistory(tx, {
					collectionId: collection.id,
					actorProfileId: self.id,
				});
				const saved = await applyCollectionBatch(tx, {
					collectionId: collection.id,
					actorProfileId: self.id,
					baseRevisionId: initial.revisionId,
					commands: ids.map((targetId, index) => ({
						opId: String(index),
						type: "item.add" as const,
						targetId,
					})),
					ensureTargetReadable: async (targetId) => {
						const decision = await authorization.unit.decideInTransaction(
							tx,
							targetId,
							"unit.read",
						);
						assert.ok(decision.allowed);
					},
					errors: { invalid: (message) => new Error(message) },
				});
				return { id: collection.id, revisionId: saved.revisionId };
			}
			const main = await curated("Minecraft Wiki", [article.id, hiddenArticle.id, modArticle.id]);
			const mods = await curated("Minecraft modding projects", [modArticle.id]);
			async function portal(title: string, collections: string[]) {
				const zone = await resource("zone", title);
				await provisionZoneDefaultExperienceInTransaction(tx, {
					zoneId: zone.id,
					actorProfileId: self.id,
					actorAuthUserId: authUserId,
					language: "en",
					title: "Updates",
				});
				const document: UnitReferencedBlockDocument = {
					_type: "block-document",
					_key: "000000000001",
					blocks: collections.map((collectionId, index) => ({
						_type: "unit-list",
						_key: `10000000000${index}`,
						source: { kind: "collection", collectionId },
						layout: "list",
						limit: 20,
					})),
				};
				const page = await upsertZonePageUnit({
					zoneId: zone.id,
					actorProfileId: self.id,
					actorAuthUserId: authUserId,
					slug: "articles",
					localization: { language: "en", title, document },
					ensureReferences: (tx, document) =>
						assertResolvedBlockReferences(
							document,
							createUnitBlockReferenceResolver(tx, {
								host: { unitId: zone.id, kind: "zone" },
								profileId: self.id,
								authorization: authorization.unit,
							}),
						),
				});
				return { zoneId: zone.id, pageId: page.id, revisionId: page.latestUnitRevisionId };
			}
			const sharedPortal = await portal("Minecraft community portal", [main.id, mods.id]);
			const secondPortal = await portal("Minecraft wiki mirror", [main.id]);
			return {
				account,
				self,
				authority,
				authorization,
				community,
				article,
				modArticle,
				hiddenArticle,
				main,
				mods,
				sharedPortal,
				secondPortal,
			};
		});
	}),
);
check(
	(
		await database
			.select()
			.from(realmUnit)
			.where(
				and(eq(realmUnit.realmId, fixture.community.id), eq(realmUnit.unitId, fixture.article.id)),
			)
	)[0]?.publicationState,
	"active",
	"Wiki Realm publication is an independent relationship",
);
check(
	(
		await database
			.select()
			.from(collectionItem)
			.where(eq(collectionItem.unitId, fixture.modArticle.id))
	).length,
	2,
	"One native article belongs to two curated Collections",
);
const anonymous = new Authorization(undefined);
const first = await getCollectionContent(fixture.main.id, anonymous, { limit: 1 });
check(
	first.items.map((row) => row.membership.targetId),
	[fixture.article.id],
	"The public Collection reads the original article identity",
);
assert.ok(first.nextCursor);
const second = await getCollectionContent(fixture.main.id, anonymous, {
	limit: 1,
	cursor: first.nextCursor,
});
check(second.items, [], "An inaccessible member is not disclosed as content");
assert.ok(second.nextCursor);
const hiddenBoundaryCursor = second.nextCursor;
check(
	Buffer.from(second.nextCursor, "base64url").toString("utf8").includes(fixture.hiddenArticle.id),
	false,
	"A public continuation must not expose a hidden member's native identity",
);
const third = await getCollectionContent(fixture.main.id, anonymous, {
	limit: 1,
	cursor: hiddenBoundaryCursor,
});
check(
	third.items.map((row) => row.membership.targetId),
	[fixture.modArticle.id],
	"Paging continues beyond a hidden member",
);
check(third.nextCursor, null, "The bounded member sequence exhausts");
await assert.rejects(
	() =>
		getCollectionContent(fixture.main.id, fixture.authorization, {
			limit: 1,
			cursor: hiddenBoundaryCursor,
		}),
	InvalidPaginationCursor,
);
checks++;
async function render(portal: typeof fixture.sharedPortal) {
	await anonymous.unit.ensureCanRead(portal.zoneId);
	await anonymous.unit.ensureCanRead(portal.pageId);
	const surface = await loadZonePageExecutionSurface({
		...portal,
		includeDock: false,
		localizationLanguages: ["en"],
	});
	const selection = selectZonePageBlockExecutions(surface.plan, {});
	return executeZonePageAggregate({
		surface,
		...selection,
		authorization: anonymous,
		localizationLanguages: ["en"],
		executors: {
			executeSearch: async () => {
				throw new Error("Stored Collections must not execute search");
			},
			executeFeed: async () => {
				throw new Error("This page contains only stored Collection sources");
			},
		},
	});
}
const one = await render(fixture.sharedPortal),
	two = await render(fixture.secondPortal);
check(
	one.page.results.map((row) => row.outcome.kind),
	["ok", "ok"],
	"One Zone presents several independently maintained Collections",
);
check(
	two.page.results.map((row) => row.outcome.kind),
	["ok"],
	"One Collection is reusable in another Zone",
);
check(
	JSON.stringify([one, two]).includes(fixture.hiddenArticle.id),
	false,
	"Zone presentations do not reveal hidden Collection members",
);
const previousCursor = first.nextCursor;
await withDatabaseTransactionDeadline(60000, () =>
	database.transaction((tx) =>
		runWithParticipationAuthority(fixture.authority, async () => {
			await fixture.authorization.unit.ensureInTransaction(
				tx,
				fixture.sharedPortal.zoneId,
				"zone.pages.manage",
			);
			await upsertZonePageUnit({
				zoneId: fixture.sharedPortal.zoneId,
				pageId: fixture.sharedPortal.pageId,
				actorProfileId: fixture.self.id,
				actorAuthUserId: fixture.account.id,
				baseUnitRevisionId: fixture.sharedPortal.revisionId,
				localization: {
					language: "en",
					title: "Modding portal",
					document: {
						_type: "block-document",
						_key: "000000000001",
						blocks: [
							{
								_type: "unit-list",
								_key: "100000000001",
								source: { kind: "collection", collectionId: fixture.mods.id },
								layout: "list",
								limit: 20,
							},
						],
					},
				},
				ensureReferences: (tx, document) =>
					assertResolvedBlockReferences(
						document,
						createUnitBlockReferenceResolver(tx, {
							host: { unitId: fixture.sharedPortal.zoneId, kind: "zone" },
							profileId: fixture.self.id,
							authorization: fixture.authorization.unit,
						}),
					),
			});
		}),
	),
);
check(
	(await render(fixture.sharedPortal)).page.results.length,
	1,
	"Removing one presentation leaves the other Collection mounted",
);
check(
	(await render(fixture.secondPortal)).page.results.length,
	1,
	"The shared Collection remains mounted in another Zone",
);
check(
	(
		await database
			.select()
			.from(collectionItem)
			.where(eq(collectionItem.collectionId, fixture.main.id))
	).length,
	3,
	"Page composition does not edit curated membership",
);
await withDatabaseTransactionDeadline(60000, () =>
	database.transaction((tx) =>
		runWithParticipationAuthority(fixture.authority, async () => {
			await fixture.authorization.unit.ensureInTransaction(tx, fixture.main.id, "unit.update");
			await applyCollectionBatch(tx, {
				collectionId: fixture.main.id,
				actorProfileId: fixture.self.id,
				baseRevisionId: fixture.main.revisionId,
				commands: [{ opId: "remove", type: "item.remove", targetId: fixture.article.id }],
				ensureTargetReadable: async (id) => {
					await fixture.authorization.unit.ensureInTransaction(tx, id, "unit.read");
				},
				errors: { invalid: (message) => new Error(message) },
			});
		}),
	),
);
check(
	(
		await database
			.select()
			.from(realmUnit)
			.where(
				and(eq(realmUnit.realmId, fixture.community.id), eq(realmUnit.unitId, fixture.article.id)),
			)
	)[0]?.publicationState,
	"active",
	"Removing Collection membership does not withdraw Realm publication",
);
await assert.rejects(
	() => getCollectionContent(fixture.main.id, anonymous, { limit: 1, cursor: previousCursor }),
	InvalidPaginationCursor,
);
checks++;
await withdrawUnitRealmPublication({
	unitId: fixture.modArticle.id,
	realmId: fixture.community.id,
	authorization: fixture.authorization,
});
check(
	(
		await database
			.select()
			.from(collectionItem)
			.where(eq(collectionItem.unitId, fixture.modArticle.id))
	).length,
	2,
	"Realm withdrawal does not rewrite Collection membership",
);
check(
	(
		await database
			.select()
			.from(post)
			.where(
				inArray(post.id, [fixture.article.id, fixture.modArticle.id, fixture.hiddenArticle.id]),
			)
	).length,
	3,
	"All native wiki identities survive presentation/grouping/publication changes",
);
check(
	(await getCollectionContent(fixture.mods.id, anonymous, { limit: 20 })).items.map(
		(row) => row.membership.targetId,
	),
	[fixture.modArticle.id],
	"A globally published article remains readable through its Collection after Realm withdrawal",
);
await setImmediate();
check(
	overlappingQueries,
	0,
	"Collection-backed Zone reads do not queue concurrent queries on one transaction client",
);
const { default: collectionRoutes } = await import("../src/services/api/collections");
const { default: errors } = await import("../src/services/api/error-boundary");
const api = new Elysia({ prefix: "/api/v1" }).use(errors).use(collectionRoutes);
api.compile();
async function readList(query: string, cookie?: string, status = 200, invalidSelection = false) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/collections?${query}`, {
			headers: {
				...(cookie ? { Cookie: cookie } : {}),
				...(invalidSelection
					? {
							"X-Rezics-Participation": JSON.stringify({
								actingEntityId: fixture.self.id,
								grant: { id: crypto.randomUUID(), revision: 1 },
							}),
						}
					: {}),
			},
		}),
	);
	const body = await response.text();
	assert.equal(response.status, status, body);
	httpChecks++;
	return JSON.parse(body);
}
check(
	(await readList(`containsTargetId=${fixture.hiddenArticle.id}`)).items,
	[],
	"Public membership search cannot reveal Collections containing an unreadable target",
);
check(
	(await readList(`targetId=${fixture.hiddenArticle.id}`)).items,
	[],
	"Public membership flags cannot reveal an unreadable target",
);
check(
	(await readList(`containsTargetId=${fixture.modArticle.id}`)).items
		.map((row: { id: string }) => row.id)
		.sort(),
	[fixture.main.id, fixture.mods.id].sort(),
	"Readable target search still finds both curated Collections",
);
check(
	(await readList(`targetId=${fixture.modArticle.id}&containsTargetId=${fixture.hiddenArticle.id}`))
		.items,
	[],
	"Both target predicates require disclosure authority",
);
check(
	(await readList(`containsTargetId=${crypto.randomUUID()}`)).items,
	[],
	"Missing and inaccessible targets share an empty result",
);
const { auth } = await import("../src/services/auth");
const { serializeSignedCookie } = await import("better-call");
const authContext = await auth.$context,
	session = await authContext.internalAdapter.createSession(fixture.account.id);
const [cookie] = (
	await serializeSignedCookie(
		authContext.authCookies.sessionToken.name,
		session.token,
		authContext.secret,
		{ path: "/" },
	)
).split(";");
assert.ok(cookie);
check(
	(await readList(`containsTargetId=${fixture.hiddenArticle.id}`, cookie)).items.map(
		(row: { id: string }) => row.id,
	),
	[fixture.main.id],
	"An authorized curator can still query known private membership",
);
async function readItems(cursor?: string, status = 200) {
	const response = await api.fetch(
		new Request(
			`http://localhost:3001/api/v1/collections/${fixture.main.id}/items?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
		),
	);
	const text = await response.text();
	assert.equal(response.status, status, text);
	httpChecks++;
	return JSON.parse(text);
}
const hiddenPage = await readItems();
check(hiddenPage.items, [], "The public HTTP page omits the private first member");
assert.equal(typeof hiddenPage.nextCursor, "string");
check(
	Buffer.from(hiddenPage.nextCursor.split(".")[1], "base64url")
		.toString()
		.includes(fixture.hiddenArticle.id),
	false,
	"The actual HTTP continuation hides the private native ID",
);
check(
	(await readItems(hiddenPage.nextCursor)).items.map(
		(row: { membership: { targetId: string } }) => row.membership.targetId,
	),
	[fixture.modArticle.id],
	"The HTTP continuation preserves progress through hidden rows",
);
check(
	(await readItems("ci2.invalid", 400)).error.code,
	"InvalidPaginationCursor",
	"Malformed sealed HTTP cursors return the typed error",
);
check(
	(await readList(`containsTargetId=${fixture.modArticle.id}`, cookie, 403, true)).error.code,
	"ParticipationDenied",
	"Invalid selected authority is a typed public read failure",
);
async function observeBlocker(holder: number) {
	for (let attempt = 0; attempt < 500; attempt++) {
		const rows = (
			await database.execute<{ pid: number }>(
				sql`select pid from pg_stat_activity where ${holder}=any(pg_blocking_pids(pid))`,
			)
		).rows;
		if (rows.length === 1) {
			checks++;
			return rows[0]!.pid;
		}
		await setTimeout(10);
	}
	throw new Error("The exact Collection target reader did not meet its blocker");
}
for (const scenario of ["visibility", "grant-expiry"] as const) {
	let cookieForRace: string | undefined, expiresAt: Date | undefined;
	const targetId = scenario === "visibility" ? fixture.modArticle.id : fixture.hiddenArticle.id;
	if (scenario === "grant-expiry") {
		const reader = await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Wiki membership reader",
					email: `${crypto.randomUUID()}@example.invalid`,
					emailVerified: true,
				})
				.returning();
			assert.ok(account);
			await ensureSelfEntityInTransaction(tx, account);
			return account;
		});
		const session = await authContext.internalAdapter.createSession(reader.id);
		[cookieForRace] = (
			await serializeSignedCookie(
				authContext.authCookies.sessionToken.name,
				session.token,
				authContext.secret,
				{ path: "/" },
			)
		).split(";");
		expiresAt = new Date(Date.now() + 3000);
		await database
			.insert(unitAccessGrant)
			.values({
				unitId: targetId,
				subjectKind: "auth",
				authUserId: reader.id,
				permission: "unit.read",
				scope: [],
				grantedByAuthUserId: fixture.account.id,
				expiresAt,
			});
	}
	const ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>();
	const holding = database.transaction(async (tx) => {
		if (scenario === "visibility")
			await tx.update(post).set({ visibility: "private" }).where(eq(post.id, targetId));
		else await tx.execute(sql`lock table collection_item in access exclusive mode`);
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
		if (expiresAt)
			await tx.execute(
				sql`select pg_sleep(greatest(0,extract(epoch from ${expiresAt}::timestamptz-clock_timestamp()))+0.1)`,
			);
	});
	void holding.catch(ready.reject);
	const holder = await ready.promise;
	const reading = readList(`containsTargetId=${targetId}`, cookieForRace);
	void reading.catch(() => {});
	try {
		await observeBlocker(holder);
	} finally {
		release.resolve();
		await holding;
	}
	check((await reading).items, [], `${scenario} during the membership query prevents disclosure`);
}
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-wiki-collection-composition.ts",
	"services/main/src/services/api/collections/items-cursor.ts",
	"services/main/src/services/api/collections/service.ts",
	"services/main/src/services/api/collections/index.ts",
	"services/main/src/services/api/feed/index.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(`../../../${path}`, import.meta.url)))
		.digest("hex");
console.info(
	JSON.stringify({
		checks,
		httpChecks,
		sourceDigests,
		orderedTargetRaces: 2,
		fixturesRetained: true,
		fixture: {
			realmId: fixture.community.id,
			collectionIds: [fixture.main.id, fixture.mods.id],
			zoneIds: [fixture.sharedPortal.zoneId, fixture.secondPortal.zoneId],
		},
	}),
);
await database.$client.end();
await observability.shutdown();
