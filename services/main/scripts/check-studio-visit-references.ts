import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { and, eq, sql } from "drizzle-orm";
import { CatalogOwnerValues } from "@rezics/reference";
import { initializeObservability } from "@rezics/observability";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import { users, post, studioResourceVisit, accountErasure } from "../src/services/database/schema";
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
import { UnitNotFound } from "../src/services/units/errors";
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
	service: { name: "studio-reference-fixture", version: "1", environment: "tooling" },
});
const { recordStudioVisit, listStudioContent } = await import("../src/services/studio/service");
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
const input = (person: Actor, unitId: string) => ({
	authUserId: person.account.id,
	authorization: person.authorization,
	unitId,
});
const listingTimingsMs: number[] = [];
const list = async (person: Actor, cursor?: string) => {
	const start = performance.now();
	const result = await listStudioContent({
		authUserId: person.account.id,
		profileId: person.self.id,
		authority: person.authority,
		authorization: person.authorization.unit,
		query: { source: "created", limit: 2, cursor },
		includeDevelopmentPreview: false,
	});
	listingTimingsMs.push(performance.now() - start);
	return result;
};
async function targetPost(tx: DatabaseTransaction) {
	const [resource] = await tx
		.insert(post)
		.values({ status: "published", visibility: "public", publishedAt: new Date() })
		.returning();
	assert.ok(resource);
	return resource;
}
const rollback = new Error("rollback canonical Studio visits");
try {
	await withDatabaseTransactionDeadline(180000, () =>
		database.transaction(async (tx) => {
			const columns = (
				await tx.execute<{ column_name: string }>(
					sql`select column_name from information_schema.columns where table_schema='public' and table_name='studio_resource_visit' order by ordinal_position`,
				)
			).rows
				.map((row) => row.column_name)
				.sort();
			check(
				columns,
				["auth_user_id", "last_visited_at", "target_reference_id"],
				"The private fact stores only Auth, canonical REF and visit time",
			);
			const owner = await actor(tx, "Canonical Studio owner"),
				other = await actor(tx, "Canonical Studio other");
			const resources = [];
			for (const kind of CatalogOwnerValues) {
				const resource = await runWithParticipationAuthority(owner.authority, () =>
					createCatalogIdentity(
						tx,
						{ owner: kind, shape: "unknown", status: "published", visibility: "public" },
						owner.account.id,
					),
				);
				resources.push(resource);
				check(
					await findReferenceValueByNativeId(tx, resource.id),
					undefined,
					"Unvisited catalog creation does not require a reference",
				);
			}
			const before = await list(owner),
				otherBefore = await list(other);
			const targets: { id: string; referenceId: string }[] = [];
			for (const resource of resources) {
				check(
					await findReferenceValueByNativeId(tx, resource.id),
					undefined,
					"Listing never allocates a reference for an unvisited candidate",
				);
				const visit = await recordStudioVisit(input(owner, resource.id));
				const value = await findReferenceValueByNativeId(tx, resource.id);
				assert.ok(value);
				targets.push({ id: resource.id, referenceId: value.valueId });
				check(visit.unitId, resource.id, "API IDs are native identities");
				check(
					(
						await tx
							.select()
							.from(studioResourceVisit)
							.where(
								and(
									eq(studioResourceVisit.authUserId, owner.account.id),
									eq(studioResourceVisit.targetReferenceId, value.valueId),
								),
							)
					).length,
					1,
					"Each owner uses a canonical target",
				);
			}
			const after = await list(owner);
			check(
				after.items.map((row) => row.id),
				before.items.map((row) => row.id),
				"Visits do not reorder source candidates",
			);
			check(after.nextCursor, before.nextCursor, "Visits do not alter the source cursor");
			const first = targets[0]!;
			await recordStudioVisit(input(owner, first.id));
			await recordStudioVisit(input(other, first.id));
			check(
				(
					await tx
						.select()
						.from(studioResourceVisit)
						.where(eq(studioResourceVisit.targetReferenceId, first.referenceId))
				).length,
				2,
				"Two accounts share one REF with separate private visits",
			);
			check(
				(await list(other)).items.map((row) => row.id),
				otherBefore.items.map((row) => row.id),
				"A visit alone never creates editor eligibility",
			);
			await tx
				.update(studioResourceVisit)
				.set({ lastVisitedAt: new Date("2030-01-01T00:00:00Z") })
				.where(eq(studioResourceVisit.authUserId, other.account.id));
			const privateTimes = new Map(
				(
					await tx
						.select()
						.from(studioResourceVisit)
						.where(eq(studioResourceVisit.authUserId, owner.account.id))
				).map((row) => [row.targetReferenceId, row.lastVisitedAt.getTime()]),
			);
			const seen = new Set<string>();
			let cursor: string | undefined;
			for (let page = 0; page < 10; page++) {
				const result = await list(owner, cursor);
				for (const item of result.items) {
					check(seen.has(item.id), false, "Keyset pages contain no duplicates");
					seen.add(item.id);
					check(
						item.lastVisitedAt?.getTime(),
						privateTimes.get(targets.find((target) => target.id === item.id)?.referenceId ?? ""),
						"Listing resolves only this account's exact visit time",
					);
				}
				if (!result.nextCursor) {
					cursor = undefined;
					break;
				}
				cursor = result.nextCursor;
			}
			check(cursor, undefined, "The bounded candidate set exhausts");
			check(
				[...seen].sort(),
				[owner.self.id, ...targets.map((row) => row.id)].sort(),
				"All catalog candidates retain native identities",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(studioResourceVisit)
						.values({ authUserId: owner.account.id, targetReferenceId: crypto.randomUUID() }),
				"23503",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(studioResourceVisit)
						.values({ authUserId: owner.account.id, targetReferenceId: first.referenceId }),
				"23505",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(studioResourceVisit)
						.values({ authUserId: crypto.randomUUID(), targetReferenceId: first.referenceId }),
				"23514",
			);
			const hidden = await targetPost(tx);
			await tx.update(post).set({ visibility: "private" }).where(eq(post.id, hidden.id));
			await assert.rejects(
				tx.transaction(() => recordStudioVisit(input(owner, hidden.id))),
				UnitNotFound,
			);
			checks++;
			check(
				await findReferenceValueByNativeId(tx, hidden.id),
				undefined,
				"Denied disclosure does not allocate a reference",
			);
			const merged = await createReviewedFixtureMerge(tx, {
				prepareSource: async (nested, source) => {
					await nested.insert(studioResourceVisit).values({
						authUserId: owner.account.id,
						targetReferenceId: await allocateReferenceValue(nested, source),
					});
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
				"Actual reviewed merge canonicalizes the pair",
			);
			check(
				(
					await tx
						.select()
						.from(studioResourceVisit)
						.where(eq(studioResourceVisit.targetReferenceId, original.valueId))
				).length,
				1,
				"Merge retains the original private reference",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(studioResourceVisit)
						.values({ authUserId: other.account.id, targetReferenceId: original.valueId }),
				"23514",
			);
			await assert.rejects(
				tx.transaction(() => recordStudioVisit(input(owner, merged.source.id))),
				UnitNotFound,
			);
			checks++;
			const load = await actor(tx, "Studio capacity sample");
			let recentBoundary: string | undefined;
			let lookupNativeId: string | null | undefined;
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
					.returning({ id: referenceValue.id, nativeId: referenceValue.targetPostId });
				if (start === 5000) {
					recentBoundary = values[250]!.id;
					lookupNativeId = values[250]!.nativeId;
				}
				await tx.insert(studioResourceVisit).values(
					values.map((row) => ({
						authUserId: load.account.id,
						targetReferenceId: row.id,
						lastVisitedAt: new Date("2026-01-01T00:00:00Z"),
					})),
				);
			}
			await tx.execute(sql`analyze studio_resource_visit,reference_value`);
			storage = (
				await tx.execute(sql`select avg(pg_column_size(v))::float8 as visit_tuple_bytes,
(select count(*)::int from pg_indexes where schemaname='public' and tablename='studio_resource_visit') as index_count,
pg_relation_size('studio_resource_visit') as heap_bytes,pg_indexes_size('studio_resource_visit') as index_bytes
from studio_resource_visit v where auth_user_id=${load.account.id}::uuid`)
			).rows[0];
			assert.ok(lookupNativeId);
			const lookupPlan =
				await tx.execute(sql`explain(analyze,buffers,format json) select last_visited_at from studio_resource_visit
where auth_user_id=${load.account.id}::uuid and target_reference_id=${referenceValueIdForNativeId(lookupNativeId)}`);
			const reversePlan =
				await tx.execute(sql`explain(analyze,buffers,format json) select auth_user_id from studio_resource_visit
where target_reference_id=${first.referenceId}::uuid order by auth_user_id limit 31`);
			assert.ok(recentBoundary);
			const recentPlan =
				await tx.execute(sql`explain(analyze,buffers,format json) select target_reference_id from studio_resource_visit
where auth_user_id=${load.account.id}::uuid and (last_visited_at,target_reference_id)<('2026-01-01'::timestamptz,${recentBoundary}::uuid)
order by last_visited_at desc nulls last,target_reference_id desc nulls last limit 31`);
			plans = { lookup: lookupPlan.rows, reverse: reversePlan.rows, recent: recentPlan.rows };
			check(
				JSON.stringify(lookupPlan.rows).includes("reference_value_native_id_idx"),
				true,
				"Native lookup seeks canonical reference index",
			);
			check(
				/studio_resource_visit_(pkey|resource_merge_idx)/u.test(JSON.stringify(lookupPlan.rows)),
				true,
				"Hot-account point lookup uses a compound account/reference index",
			);
			check(
				JSON.stringify(reversePlan.rows).includes("studio_resource_visit_resource_merge_idx"),
				true,
				"Reference reverse lookup is indexed",
			);
			check(
				JSON.stringify(recentPlan.rows).includes("studio_resource_visit_auth_recent_idx"),
				true,
				"Recent visits use the Auth-leading keyset index",
			);
			check(
				JSON.stringify(recentPlan.rows).includes('"Node Type":"Sort"'),
				false,
				"Recent keyset needs no Sort",
			);
			// Erasure spans more than one 500-row worker page without deleting other accounts or reference anchors.
			await tx.insert(studioResourceVisit).select(
				tx
					.select({
						authUserId: sql<string>`${owner.account.id}::uuid`.as("auth_user_id"),
						targetReferenceId: studioResourceVisit.targetReferenceId,
						lastVisitedAt: studioResourceVisit.lastVisitedAt,
					})
					.from(studioResourceVisit)
					.where(eq(studioResourceVisit.authUserId, load.account.id))
					.limit(600),
			);
			await runWithParticipationAuthority(owner.authority, () =>
				eraseOwnAccount(tx, owner.authority),
			);
			let erased = false;
			let visitErasurePages = 0;
			for (let page = 0; page < 100; page++) {
				const [job] = await tx
					.update(accountErasure)
					.set({ availableAt: new Date(0) })
					.where(eq(accountErasure.authUserId, owner.account.id))
					.returning({ stage: accountErasure.stage });
				const deleted = await dispatchAccountErasureBatch({ authUserId: owner.account.id });
				if (job?.stage === "studio_visits") {
					check(deleted <= 500, true, "One private erasure page deletes at most 500 rows");
					if (deleted > 0) visitErasurePages++;
				}
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
			check(erased, true, "Actual erasure completes through bounded worker pages");
			check(visitErasurePages, 2, "The fixture crosses two visit deletion pages");
			check(
				(
					await tx
						.select()
						.from(studioResourceVisit)
						.where(eq(studioResourceVisit.authUserId, owner.account.id))
				).length,
				0,
				"Erasure removes private visits",
			);
			check(
				(
					await tx
						.select()
						.from(studioResourceVisit)
						.where(eq(studioResourceVisit.authUserId, other.account.id))
				).length,
				1,
				"Another account retains its visit",
			);
			check(
				(await findReferenceValueByNativeId(tx, first.id))?.valueId,
				first.referenceId,
				"Erasure retains the shared reference anchor",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(studioResourceVisit)
						.values({ authUserId: owner.account.id, targetReferenceId: first.referenceId }),
				"23514",
			);
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) {
		console.info(JSON.stringify({ checks, storage, plans, listingTimingsMs }));
		throw error;
	}
}
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-studio-visit-references.ts",
	"libraries/schema/src/postgres/community/studio.ts",
	"services/main/src/services/studio/service.ts",
	"services/main/src/services/database/schema/postgres/merge-integrity.sql",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(`../../../${path}`, import.meta.url)))
		.digest("hex");
console.info(
	JSON.stringify({
		checks,
		storage,
		plans,
		loadRows: 10000,
		listingTimingsMs,
		sourceDigests,
		rollback: true,
	}),
);
await database.$client.end();
await observability.shutdown();
