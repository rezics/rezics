import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { and, eq, inArray, sql } from "drizzle-orm";
import { CatalogOwnerValues } from "@rezics/reference";
import { OfficialZoneManifest } from "../src/services/bootstrap/data";
import { OfficialZoneUnitIds } from "@rezics/slug";
import { initializeObservability } from "@rezics/observability";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	post,
	zone,
	tag,
	vocabularyNode,
	unitLocalization,
	unitFollow,
	accountFollowPreference,
	unitFollowStat,
	accountErasure,
	catalogRoutingControl,
} from "../src/services/database/schema";
import { referenceValue } from "@rezics/schema/postgres/knowledge/reference-value";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { runWithParticipationAuthority } from "../src/services/participation/policy";
import { createCatalogIdentity } from "../src/services/catalog/storage";
import {
	allocateReferenceValue,
	findReferenceValueByNativeId,
	referenceValueIdForNativeId,
} from "../src/services/units/reference-value";
import {
	followUnit,
	unfollowUnit,
	listFollowing,
	getFollowingStatus,
} from "../src/services/following/service";
import { InvalidPaginationCursor } from "../src/services/pagination/errors";
import { UnitNotFound } from "../src/services/units/errors";
import { ensureOfficialZoneFollows } from "../src/services/bootstrap/official-zone-follows";
import {
	eraseOwnAccount,
	dispatchAccountErasureBatch,
} from "../src/services/participation/erasure";
import { createReviewedFixtureMerge } from "./reference-merge-fixture";
import {
	claimUnitMergeOperations,
	processClaimedUnitMergePage,
} from "../src/services/units/merge/worker";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
		url.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname),
);
const observability = initializeObservability({
	service: { name: "following-reference-fixture", version: "1", environment: "tooling" },
});
let checks = 0;
let storage: unknown, plans: unknown;
const check = (actual: unknown, expected: unknown, message: string) => {
	assert.deepEqual(actual, expected, message);
	checks++;
};
async function reject(
	tx: DatabaseTransaction,
	work: (tx: DatabaseTransaction) => Promise<unknown>,
	code: string,
) {
	await assert.rejects(tx.transaction(work), (error: unknown) => {
		while (error instanceof Error && error.cause) error = error.cause;
		return typeof error === "object" && error !== null && "code" in error && error.code === code;
	});
	checks++;
}
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
const input = (actor: Actor, unitId: string) => ({
	authUserId: actor.account.id,
	followerProfileId: actor.self.id,
	authorization: actor.authorization,
	unitId,
});
async function targetPost(tx: DatabaseTransaction) {
	const [resource] = await tx
		.insert(post)
		.values({ status: "published", visibility: "public", publishedAt: new Date() })
		.returning();
	assert.ok(resource);
	return resource;
}
const rollback = new Error("rollback canonical Following references");
try {
	await withDatabaseTransactionDeadline(180000, () =>
		database.transaction(async (tx) => {
			const owner = await actor(tx, "Canonical Following owner"),
				other = await actor(tx, "Canonical Following other");
			const targets: { id: string; referenceId: string }[] = [];
			for (const kind of CatalogOwnerValues) {
				const resource = await runWithParticipationAuthority(owner.authority, () =>
					createCatalogIdentity(
						tx,
						{ owner: kind, shape: "unknown", status: "published", visibility: "public" },
						owner.account.id,
					),
				);
				await followUnit(input(owner, resource.id));
				const value = await findReferenceValueByNativeId(tx, resource.id);
				assert.ok(value);
				targets.push({ id: resource.id, referenceId: value.valueId });
				check(
					(await getFollowingStatus(input(owner, resource.id))).following,
					true,
					"Every catalog owner is addressable through its canonical reference",
				);
				check(
					(
						await tx
							.select()
							.from(unitFollow)
							.where(
								and(
									eq(unitFollow.followerProfileId, owner.self.id),
									eq(unitFollow.targetReferenceId, value.valueId),
								),
							)
					).length,
					1,
					"The public relation stores the shared reference",
				);
				check(
					(
						await tx
							.select()
							.from(accountFollowPreference)
							.where(
								and(
									eq(accountFollowPreference.authUserId, owner.account.id),
									eq(accountFollowPreference.targetReferenceId, value.valueId),
								),
							)
					).length,
					1,
					"The private preference uses the same parent reference",
				);
			}
			const first = targets[0]!,
				second = targets[1]!;
			await followUnit(input(owner, first.id));
			check(
				(await tx.select().from(unitFollowStat).where(eq(unitFollowStat.unitId, first.id)))[0]
					?.followerCount,
				1n,
				"Idempotent follow does not double-count",
			);
			await followUnit(input(other, first.id));
			check(
				(await tx.select().from(unitFollowStat).where(eq(unitFollowStat.unitId, first.id)))[0]
					?.followerCount,
				2n,
				"Two accounts share one reference and contribute two follows",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(unitFollow)
						.values({ followerProfileId: owner.self.id, targetReferenceId: first.referenceId }),
				"23505",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(unitFollow)
						.values({ followerProfileId: owner.self.id, targetReferenceId: crypto.randomUUID() }),
				"23503",
			);
			const selfReference = await allocateReferenceValue(tx, {
				owner: "entity",
				id: owner.self.id,
			});
			await reject(
				tx,
				(nested) =>
					nested
						.insert(unitFollow)
						.values({ followerProfileId: owner.self.id, targetReferenceId: selfReference }),
				"23514",
			);
			await reject(
				tx,
				(nested) =>
					nested.insert(accountFollowPreference).values({
						authUserId: other.account.id,
						followerEntityId: owner.self.id,
						targetReferenceId: second.referenceId,
					}),
				"23514",
			);
			await reject(
				tx,
				(nested) =>
					nested.insert(accountFollowPreference).values({
						authUserId: other.account.id,
						followerEntityId: other.self.id,
						targetReferenceId: second.referenceId,
					}),
				"23503",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.update(accountFollowPreference)
						.set({ targetReferenceId: second.referenceId })
						.where(
							and(
								eq(accountFollowPreference.authUserId, owner.account.id),
								eq(accountFollowPreference.targetReferenceId, first.referenceId),
							),
						),
				"23514",
			);
			const restoreRouting = new Error("restore routing control");
			await assert.rejects(
				tx.transaction(async (nested) => {
					await nested
						.update(catalogRoutingControl)
						.set({ ready: false })
						.where(eq(catalogRoutingControl.singleton, true));
					await nested
						.insert(unitFollow)
						.values({ followerProfileId: other.self.id, targetReferenceId: second.referenceId });
					check(
						(
							await nested.select().from(unitFollowStat).where(eq(unitFollowStat.unitId, second.id))
						)[0]?.followerCount,
						2n,
						"Canonical references maintain counters while routing is fenced",
					);
					await nested
						.delete(unitFollow)
						.where(
							and(
								eq(unitFollow.followerProfileId, other.self.id),
								eq(unitFollow.targetReferenceId, second.referenceId),
							),
						);
					check(
						(
							await nested.select().from(unitFollowStat).where(eq(unitFollowStat.unitId, second.id))
						)[0]?.followerCount,
						1n,
						"Routing repair cannot silently skip a counter decrement",
					);
					throw restoreRouting;
				}),
				(error) => error === restoreRouting,
			);
			const namespaceTarget = await targetPost(tx);
			await tx
				.insert(referenceValue)
				.values({ id: owner.self.id, targetPostId: namespaceTarget.id });
			await followUnit(input(owner, namespaceTarget.id));
			check(
				(await findReferenceValueByNativeId(tx, namespaceTarget.id))?.valueId,
				owner.self.id,
				"Reference UUID equality does not mean native self-follow",
			);
			const cteTarget = await targetPost(tx);
			await tx.execute(sql`with allocated as (insert into reference_value(target_post_id) values(${cteTarget.id}::uuid) returning id)
   insert into unit_follow(follower_profile_id,target_reference_id) select ${owner.self.id}::uuid,id from allocated`);
			check(
				(await tx.select().from(unitFollowStat).where(eq(unitFollowStat.unitId, cteTarget.id)))[0]
					?.followerCount,
				1n,
				"The counter sees references allocated in the same statement",
			);
			await tx
				.update(accountFollowPreference)
				.set({ favorite: true, position: "a0V" })
				.where(
					and(
						eq(accountFollowPreference.authUserId, owner.account.id),
						inArray(accountFollowPreference.targetReferenceId, [
							first.referenceId,
							second.referenceId,
						]),
					),
				);
			const listInput = {
				authUserId: owner.account.id,
				followerProfileId: owner.self.id,
				authorization: owner.authorization,
				limit: 1,
			};
			const page = await listFollowing(listInput);
			assert.ok(page.nextCursor);
			const next = await listFollowing({ ...listInput, cursor: page.nextCursor });
			const expected = [first, second]
				.sort((a, b) => a.referenceId.localeCompare(b.referenceId))
				.map((row) => row.id);
			check(
				[page.items[0]?.id, next.items[0]?.id],
				expected,
				"Cursor ties follow the indexed reference order while returning native identities",
			);
			check(
				"targetReferenceId" in page.items[0]!,
				false,
				"Response rows do not leak internal ordering fields",
			);
			const decoded = JSON.parse(Buffer.from(page.nextCursor, "base64url").toString());
			check(decoded.v, 4, "The cursor identifies the canonical-reference ordering contract");
			check("unitId" in decoded, false, "The cursor contains only its declared reference boundary");
			await assert.rejects(
				listFollowing({
					...listInput,
					cursor: Buffer.from(JSON.stringify({ ...decoded, v: 3 })).toString("base64url"),
				}),
				InvalidPaginationCursor,
			);
			checks++;
			const officialIds = Object.values(OfficialZoneUnitIds);
			await tx
				.insert(zone)
				.values(
					OfficialZoneManifest.map((value) => ({
						id: value.id,
						filterDocument: value.filterDocument,
						appearanceDocument: value.appearanceDocument,
						status: "published" as const,
						visibility: "public" as const,
						publishedAt: new Date(),
					})),
				)
				.onConflictDoNothing();
			const beforeDefaults = await tx
				.select()
				.from(accountFollowPreference)
				.where(eq(accountFollowPreference.authUserId, owner.account.id))
				.orderBy(accountFollowPreference.targetReferenceId);
			await ensureOfficialZoneFollows(tx, [owner.self.id]);
			const afterDefaults = await tx
				.select()
				.from(accountFollowPreference)
				.where(eq(accountFollowPreference.authUserId, owner.account.id))
				.orderBy(accountFollowPreference.targetReferenceId);
			check(
				afterDefaults.length - beforeDefaults.length,
				officialIds.length,
				"Official defaults produce linked preferences",
			);
			await ensureOfficialZoneFollows(tx, [owner.self.id]);
			check(
				await tx
					.select()
					.from(accountFollowPreference)
					.where(eq(accountFollowPreference.authUserId, owner.account.id))
					.orderBy(accountFollowPreference.targetReferenceId),
				afterDefaults,
				"Repeated default provisioning preserves all choices and positions",
			);
			const [vocabulary] = await tx.insert(vocabularyNode).values({ kind: "concept" }).returning();
			assert.ok(vocabulary);
			await tx.insert(tag).values({
				id: vocabulary.id,
				status: "published",
				visibility: "public",
				publishedAt: new Date(),
			});
			await tx
				.insert(unitLocalization)
				.values({ unitId: vocabulary.id, language: "en", title: "Canonical followed Tag" });
			await followUnit(input(owner, vocabulary.id));
			const { resolveDerivedSearchSource } = await import(
				"../src/services/api/search/derived-source"
			);
			const source = {
				kind: "derived" as const,
				select: {
					kind: "random-tag" as const,
					from: { kind: "viewer-follows" as const },
					seed: { kind: "time-bucket" as const, hours: 6 as const },
				},
				query: { feature: { kind: "global" as const } },
				fallback: { kind: "hide" as const },
			};
			const derivedInput = {
				authorization: owner.authorization,
				localizationLanguages: [],
				path: [{ slot: "blocks" as const, key: "100000000001" }],
				resource: { kind: "dock" as const, zoneId: officialIds[0]!, slot: "main" as const },
				source,
			};
			const derived = await resolveDerivedSearchSource(derivedInput);
			check(
				derived.selected?.id,
				vocabulary.id,
				"The Following-backed Tag selector resolves native Tag identities",
			);
			check(derived.cacheability, "private", "Personal selection does not enter shared caches");
			check(
				(await resolveDerivedSearchSource({ ...derivedInput, authorization: other.authorization }))
					.hidden,
				true,
				"Another account has no inherited Tag choice",
			);
			const merged = await createReviewedFixtureMerge(tx, {
				prepareSource: async (nested, source) => {
					const targetReferenceId = await allocateReferenceValue(nested, source);
					await nested
						.insert(unitFollow)
						.values({ followerProfileId: owner.self.id, targetReferenceId });
				},
			});
			const original = await findReferenceValueByNativeId(tx, merged.source.id);
			assert.ok(original);
			const [claim] = await claimUnitMergeOperations(new Date(), 1, [merged.operation.shard]);
			assert.equal(claim?.id, merged.operation.id);
			assert.ok(claim);
			check(
				(await processClaimedUnitMergePage(claim)).outcome,
				"continued",
				"A real reviewed merge canonicalizes the pair",
			);
			check(
				(
					await tx
						.select()
						.from(unitFollow)
						.where(eq(unitFollow.targetReferenceId, original.valueId))
				).length,
				1,
				"Canonicalization retains the original follow reference",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(unitFollow)
						.values({ followerProfileId: other.self.id, targetReferenceId: original.valueId }),
				"23514",
			);
			await assert.rejects(
				tx.transaction(() => followUnit(input(other, merged.source.id))),
				UnitNotFound,
			);
			checks++;
			await unfollowUnit(owner.account.id, owner.self.id, first.id, owner.authorization);
			check(
				(
					await tx
						.select()
						.from(accountFollowPreference)
						.where(
							and(
								eq(accountFollowPreference.authUserId, owner.account.id),
								eq(accountFollowPreference.targetReferenceId, first.referenceId),
							),
						)
				).length,
				0,
				"Unfollow cascades only its private preference",
			);
			check(
				(await tx.select().from(unitFollowStat).where(eq(unitFollowStat.unitId, first.id)))[0]
					?.followerCount,
				1n,
				"The native counter decrements once",
			);
			check(
				(await findReferenceValueByNativeId(tx, first.id))?.valueId,
				first.referenceId,
				"Removal retains the shared reference",
			);
			const load = await actor(tx, "Following capacity sample");
			for (let start = 0; start < 10000; start += 500) {
				const posts = await tx
					.insert(post)
					.values(
						Array.from({ length: 500 }, () => ({
							status: "published" as const,
							visibility: "public" as const,
							publishedAt: new Date(),
						})),
					)
					.returning({ id: post.id });
				const values = await tx
					.insert(referenceValue)
					.values(posts.map((row) => ({ targetPostId: row.id })))
					.returning({ id: referenceValue.id });
				await tx
					.insert(unitFollow)
					.values(
						values.map((row) => ({ followerProfileId: load.self.id, targetReferenceId: row.id })),
					);
				await tx.insert(accountFollowPreference).values(
					values.map((row, index) => ({
						authUserId: load.account.id,
						followerEntityId: load.self.id,
						targetReferenceId: row.id,
						position: `a0${String(start + index).padStart(5, "0")}V`,
					})),
				);
			}
			await tx.execute(sql`analyze unit_follow,account_follow_preference,reference_value`);
			storage = (
				await tx.execute(sql`select
   (select avg(pg_column_size(f))::float8 from unit_follow f where follower_profile_id=${load.self.id}::uuid) as follow_tuple_bytes,
   (select avg(pg_column_size(p))::float8 from account_follow_preference p where auth_user_id=${load.account.id}::uuid) as preference_tuple_bytes,
   pg_relation_size('unit_follow') as follow_heap_bytes,pg_indexes_size('unit_follow') as follow_index_bytes,
   pg_relation_size('account_follow_preference') as preference_heap_bytes,pg_indexes_size('account_follow_preference') as preference_index_bytes`)
			).rows[0];
			const orderPlan =
				await tx.execute(sql`explain(analyze,buffers,format json) select target_reference_id from account_follow_preference
   where auth_user_id=${load.account.id}::uuid and favorite=false and position>'a009900V' order by favorite desc nulls last,position,target_reference_id limit 31`);
			const reversePlan =
				await tx.execute(sql`explain(analyze,buffers,format json) select follower_profile_id from unit_follow
   where target_reference_id=${referenceValueIdForNativeId(first.id)} order by created_at desc nulls last,follower_profile_id limit 31`);
			plans = { order: orderPlan.rows, reverse: reversePlan.rows };
			check(
				JSON.stringify(orderPlan.rows).includes("account_follow_preference_auth_order_idx"),
				true,
				"The private keyset uses its account-leading order index",
			);
			check(
				JSON.stringify(reversePlan.rows).includes("reference_value_native_id_idx"),
				true,
				"Native reverse lookup uses the canonical expression index",
			);
			check(
				JSON.stringify(reversePlan.rows).includes("unit_follow_unit_created_at_idx"),
				true,
				"Follower reverse reads use the reference-leading index",
			);
			check(
				JSON.stringify(orderPlan.rows).includes('"Node Type":"Sort"'),
				false,
				"The keyset ordering matches the index without sorting the candidate range",
			);
			await runWithParticipationAuthority(owner.authority, () =>
				eraseOwnAccount(tx, owner.authority),
			);
			let erased = false;
			for (let page = 0; page < 100; page++) {
				await tx
					.update(accountErasure)
					.set({ availableAt: new Date(0) })
					.where(eq(accountErasure.authUserId, owner.account.id));
				await dispatchAccountErasureBatch({ authUserId: owner.account.id });
				if (
					(
						await tx
							.select()
							.from(accountErasure)
							.where(eq(accountErasure.authUserId, owner.account.id))
					)[0]?.stage === "complete"
				) {
					erased = true;
					break;
				}
			}
			check(erased, true, "Actual erasure completes through its worker");
			check(
				(
					await tx
						.select()
						.from(accountFollowPreference)
						.where(eq(accountFollowPreference.authUserId, owner.account.id))
				).length,
				0,
				"Erasure removes private preferences",
			);
			check(
				(await getFollowingStatus(input(other, first.id))).following,
				true,
				"Other accounts retain their choices",
			);
			check(
				(await findReferenceValueByNativeId(tx, first.id))?.valueId,
				first.referenceId,
				"Erasure preserves shared native reference anchors",
			);
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-following-references.ts",
	"libraries/schema/src/postgres/community/follow.ts",
	"services/main/src/services/database/schema/postgres/participation-follow.sql",
	"services/main/src/services/database/schema/postgres/platform-aggregates.sql",
	"services/main/src/services/following/service.ts",
	"services/main/src/services/following/cursor.ts",
	"services/main/src/services/units/reference-value.ts",
	"services/main/src/services/bootstrap/official-zone-follows.ts",
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
		storage,
		plans,
		loadRows: 10000,
		canonicalFollowingReferences: true,
		rollback: true,
	}),
);
await database.$client.end();
await observability.shutdown();
