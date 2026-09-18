import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { CatalogOwnerValues } from "@rezics/reference";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	accountErasure,
	post,
	unitAccessGrant,
	recommendationExclusion,
	recommendationEvent,
} from "../src/services/database/schema";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
import { unitStatesForIds } from "../src/services/units/state-relation";
import { UnitNotFound } from "../src/services/units/errors";
import {
	allocateReferenceValue,
	findReferenceValueByNativeId,
} from "../src/services/units/reference-value";
import {
	eraseOwnAccount,
	dispatchAccountErasureBatch,
} from "../src/services/participation/erasure";
import {
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import { createRecommendationTracking } from "../src/services/recommendations/tracking";
import { RecommendationPolicyVersion } from "../src/services/recommendations/policy";
import {
	saveRecommendationExclusion,
	removeRecommendationExclusion,
} from "../src/services/recommendations/exclusions";
import { recommendationExclusionCondition } from "../src/services/recommendations/exclusion-query";
import { createMergedFixtureReference } from "./reference-merge-fixture";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Recommendation reference checks require a disposable loopback target",
);
let checks = 0;
let queryEvidence: unknown;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
async function reject(
	tx: DatabaseTransaction,
	work: (nested: DatabaseTransaction) => Promise<unknown>,
	code: string,
) {
	await assert.rejects(tx.transaction(work), (cause: unknown) => {
		while (cause instanceof Error && cause.cause) cause = cause.cause;
		return typeof cause === "object" && cause !== null && "code" in cause && cause.code === code;
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
	const authority: ParticipationAuthority = {
		principal: { kind: "auth", authUserId: account.id },
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
function tracking(id: string) {
	return {
		...createRecommendationTracking(id, {
			requestId: crypto.randomUUID(),
			surface: "home_feed" as const,
			position: 0,
			policyVersion: RecommendationPolicyVersion,
		}),
		eventId: crypto.randomUUID(),
		occurredAt: new Date(),
	};
}
const rollback = new Error("rollback recommendation references");
try {
	await withDatabaseTransactionDeadline(120000, () =>
		database.transaction(async (tx) => {
			const owner = await actor(tx, "Exclusion owner"),
				other = await actor(tx, "Other exclusion owner");
			const targets: { id: string; referenceId: string }[] = [];
			const matches = async (id: string, authUserId: string) =>
				(
					await tx.execute<{ excluded: boolean }>(
						sql`select ${recommendationExclusionCondition(sql`${id}::uuid`, authUserId)} as excluded`,
					)
				).rows[0]?.excluded;
			for (const kind of CatalogOwnerValues) {
				const id = (
					await tx.execute<{ id: string }>(
						sql`insert into ${CatalogIdentityTables[kind]} (shape) values ('unknown') returning id`,
					)
				).rows[0]!.id;
				const referenceId = await allocateReferenceValue(tx, { owner: kind, id });
				await tx
					.insert(recommendationExclusion)
					.values({ authUserId: owner.account.id, targetReferenceId: referenceId });
				targets.push({ id, referenceId });
				check(
					await matches(id, owner.account.id),
					true,
					"private exclusions resolve every catalog owner through canonical values",
				);
			}
			const first = targets[0]!;
			check(
				await matches(first.id, other.account.id),
				false,
				"another account has an independent exclusion set",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(recommendationExclusion)
						.values({ authUserId: owner.account.id, targetReferenceId: first.referenceId }),
				"23505",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(recommendationExclusion)
						.values({ authUserId: owner.account.id, targetReferenceId: crypto.randomUUID() }),
				"23503",
			);
			await reject(
				tx,
				(nested) => nested.execute(sql`delete from publishing_identity where id=${first.id}::uuid`),
				"23001",
			);
			await tx
				.insert(recommendationExclusion)
				.values({ authUserId: other.account.id, targetReferenceId: first.referenceId });
			check(
				await matches(first.id, other.account.id),
				true,
				"accounts may reuse the same reference value",
			);

			const merged = await createMergedFixtureReference(tx);
			await reject(
				tx,
				(nested) =>
					nested.execute(
						sql`with ref as (insert into reference_value(target_publishing_id) values (${merged.sourceId}::uuid) returning id) insert into recommendation_exclusion(auth_user_id,target_reference_id) select ${owner.account.id}::uuid,id from ref`,
					),
				"23514",
			);
			const mergedReference = await allocateReferenceValue(tx, {
				owner: merged.owner,
				id: merged.sourceId,
			});
			await reject(
				tx,
				(nested) =>
					nested
						.insert(recommendationExclusion)
						.values({ authUserId: owner.account.id, targetReferenceId: mergedReference }),
				"23514",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.update(recommendationExclusion)
						.set({ targetReferenceId: mergedReference })
						.where(
							and(
								eq(recommendationExclusion.authUserId, owner.account.id),
								eq(recommendationExclusion.targetReferenceId, first.referenceId),
							),
						),
				"23514",
			);

			const [visible] = await tx
				.insert(post)
				.values({ status: "published", visibility: "public", publishedAt: new Date() })
				.returning();
			assert.ok(visible);
			const [privateTarget] = await tx
				.insert(post)
				.values({ status: "published", visibility: "private", publishedAt: new Date() })
				.returning();
			assert.ok(privateTarget);
			await assert.rejects(
				tx.transaction((nested) =>
					saveRecommendationExclusion(
						nested,
						owner.authorization,
						privateTarget.id,
						tracking(privateTarget.id),
					),
				),
				UnitNotFound,
			);
			checks++;
			check(
				await findReferenceValueByNativeId(tx, privateTarget.id),
				undefined,
				"denied targets allocate no reference values",
			);
			const event = tracking(visible.id);
			await saveRecommendationExclusion(tx, owner.authorization, visible.id, event);
			await saveRecommendationExclusion(tx, owner.authorization, visible.id, event);
			check(
				(
					await tx
						.select()
						.from(recommendationEvent)
						.where(eq(recommendationEvent.id, event.eventId))
				).length,
				1,
				"replayed exclusion events stay idempotent",
			);
			check(
				await matches(visible.id, owner.account.id),
				true,
				"a current readable target can be excluded",
			);
			await saveRecommendationExclusion(tx, other.authorization, visible.id, tracking(visible.id));
			await removeRecommendationExclusion(tx, owner.authorization, visible.id);
			check(
				await matches(visible.id, owner.account.id),
				false,
				"removal changes the actual account's choice",
			);
			check(
				await matches(visible.id, other.account.id),
				true,
				"removal preserves another account's choice",
			);
			const missing = crypto.randomUUID();
			await removeRecommendationExclusion(tx, owner.authorization, missing);
			check(
				await findReferenceValueByNativeId(tx, missing),
				undefined,
				"removing an absent choice does not allocate a reference",
			);

			const prefix = `00${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}-${crypto.randomUUID().slice(0, 4)}`;
			await tx.execute(
				sql`with native as (insert into publishing_identity(id,shape) select (${prefix} || '-8000-8000-' || lpad(to_hex(i),12,'0'))::uuid,'unknown' from generate_series(1,10000) i returning id), refs as (insert into reference_value(target_publishing_id) select id from native returning id) insert into recommendation_exclusion(auth_user_id,target_reference_id) select ${other.account.id}::uuid,id from refs`,
			);
			await tx.execute(sql`analyze recommendation_exclusion`);
			await tx.execute(sql`analyze reference_value`);
			const lookupId = `${prefix}-8000-8000-000000001388`;
			check(
				await matches(lookupId, other.account.id),
				true,
				"a hot account's private set uses native IDs",
			);
			const point = await tx.execute(
				sql`explain (analyze,buffers,format json) select ${recommendationExclusionCondition(sql`${lookupId}::uuid`, other.account.id)}`,
			);
			const sample = await tx.execute(sql`select count(*)::integer as rows,
                avg(pg_column_size(e))::numeric(10,2) as tuple_bytes,
                pg_table_size('recommendation_exclusion') as heap_bytes,
                pg_indexes_size('recommendation_exclusion') as index_bytes
                from recommendation_exclusion e`);
			queryEvidence = { sample: sample.rows[0], point: point.rows };
			check(
				JSON.stringify(point.rows).includes("reference_value_native_id_idx"),
				true,
				"point filtering uses the native reference expression index",
			);
			check(
				/recommendation_exclusion_(pkey|target_idx)/u.test(JSON.stringify(point.rows)),
				true,
				"point filtering uses a selective account/reference index",
			);

			await runWithParticipationAuthority(owner.authority, () =>
				eraseOwnAccount(tx, owner.authority),
			);
			check(
				await matches(first.id, owner.account.id),
				false,
				"erasure stops private filtering before cleanup finishes",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.insert(recommendationExclusion)
						.values({ authUserId: owner.account.id, targetReferenceId: first.referenceId }),
				"23514",
			);
			for (let page = 0; page < 100; page++) {
				await tx
					.update(accountErasure)
					.set({ availableAt: new Date(0) })
					.where(eq(accountErasure.authUserId, owner.account.id));
				await dispatchAccountErasureBatch({ authUserId: owner.account.id });
				const [job] = await tx
					.select()
					.from(accountErasure)
					.where(eq(accountErasure.authUserId, owner.account.id));
				if (job?.stage === "complete") break;
			}
			check(
				(
					await tx
						.select()
						.from(recommendationExclusion)
						.where(eq(recommendationExclusion.authUserId, owner.account.id))
				).length,
				0,
				"erasure deletes the account's exclusion rows",
			);
			check(
				await matches(first.id, other.account.id),
				true,
				"erasure preserves another account and shared references",
			);
			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}

const pool = new Pool({ connectionString: target.toString(), max: 3, statement_timeout: 14000 });
const raceDb = drizzle({ client: pool });
try {
	const seeded = await raceDb.transaction(async (tx) => {
		const owner = await actor(tx, "Exclusion grant owner"),
			reader = await actor(tx, "Exclusion grant reader");
		const [resource] = await tx
			.insert(post)
			.values({ status: "published", visibility: "private", publishedAt: new Date() })
			.returning();
		assert.ok(resource);
		const [grant] = await tx
			.insert(unitAccessGrant)
			.values({
				unitId: resource.id,
				subjectKind: "auth",
				authUserId: reader.account.id,
				permission: "unit.read",
				scope: [],
				grantedByAuthUserId: owner.account.id,
			})
			.returning();
		assert.ok(grant);
		return { owner, reader, resource, grant };
	});
	const held = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		waiting = Promise.withResolvers<number>();
	const revoker = raceDb.transaction(async (tx) => {
		await lockUnitAccessState(tx, [seeded.resource.id]);
		await tx
			.update(unitAccessGrant)
			.set({ revokedAt: new Date(), revokedByAuthUserId: seeded.owner.account.id })
			.where(eq(unitAccessGrant.id, seeded.grant.id));
		held.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void revoker.catch(held.reject);
	const blocker = await held.promise;
	const saving = raceDb.transaction(async (tx) => {
		waiting.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return saveRecommendationExclusion(
			tx,
			seeded.reader.authorization,
			seeded.resource.id,
			tracking(seeded.resource.id),
		);
	});
	void saving.catch(waiting.reject);
	const denied = assert.rejects(saving, UnitNotFound);
	void denied.catch(() => {});
	try {
		const pid = await waiting.promise;
		let blocked = false;
		for (let attempt = 0; attempt < 500; attempt++) {
			blocked =
				(
					await pool.query<{ blocked: boolean }>(
						"select $2::integer = any(pg_blocking_pids($1)) as blocked",
						[pid, blocker],
					)
				).rows[0]?.blocked ?? false;
			if (blocked) break;
			await setTimeout(10);
		}
		check(blocked, true, "exclusion waits on the exact resource revocation fence");
	} finally {
		release.resolve();
		await revoker;
		await denied;
		checks++;
	}
	check(
		await raceDb.transaction((tx) => findReferenceValueByNativeId(tx, seeded.resource.id)),
		undefined,
		"revoked capture allocates no reference",
	);
} finally {
	await pool.end();
}

const { initializeObservability } = await import("@rezics/observability");
const observability = initializeObservability({
	service: {
		name: "rezics-recommendation-reference-qualification",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { serializeSignedCookie } = await import("better-call");
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
api.compile();
const { getFeedEligibilityCondition } = await import("../src/services/api/feed");
const context = await auth.$context;
const apiActor = await database.transaction((tx) => actor(tx, "Exclusion API owner"));
const session = await context.internalAdapter.createSession(apiActor.account.id);
const [cookie] = (
	await serializeSignedCookie(
		context.authCookies.sessionToken.name,
		session.token,
		context.secret,
		{ path: "/" },
	)
).split(";");
assert.ok(cookie);
const [apiTarget] = await database
	.insert(post)
	.values({ status: "published", visibility: "public", publishedAt: new Date() })
	.returning();
assert.ok(apiTarget);
const apiTargetId = apiTarget.id;
let httpChecks = 0;
async function request(
	method: string,
	id: string,
	body: unknown,
	expectedStatus: number,
	authenticated = true,
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/recommendations/exclusions/${id}`, {
			method,
			headers: {
				...(authenticated ? { Cookie: cookie! } : {}),
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	check(response.status, expectedStatus, `${method} exclusion: ${text.slice(0, 1200)}`);
	httpChecks++;
	return text ? JSON.parse(text) : null;
}
async function eligibleForFeed() {
	const state = unitStatesForIds([apiTargetId], "search_unit");
	const rows = await database
		.select({ id: state.id })
		.from(state)
		.where(
			getFeedEligibilityCondition(
				{
					profileId: apiActor.self.id,
					personalized: true,
					contentRatings: ["general"],
					preferredLanguages: ["en"],
				},
				{ content: ["post:post"] },
				new Date(),
			),
		);
	return rows.some((row) => row.id === apiTargetId);
}
try {
	check(
		await eligibleForFeed(),
		true,
		"the actual feed predicate initially includes the public target",
	);
	const event = tracking(apiTarget.id);
	await request("PUT", apiTarget.id, event, 401, false);
	await request("PUT", apiTarget.id, { ...event, signature: "A".repeat(43) }, 422);
	check(
		await database.transaction((tx) => findReferenceValueByNativeId(tx, apiTarget.id)),
		undefined,
		"invalid tracking creates no reference value",
	);
	check(
		(await request("PUT", apiTarget.id, event, 200)).excluded,
		true,
		"signed API exclusion succeeds",
	);
	await request("PUT", apiTarget.id, event, 200);
	check(
		await eligibleForFeed(),
		false,
		"the actual feed predicate applies the canonical private exclusion",
	);
	const ref = await database.transaction((tx) => findReferenceValueByNativeId(tx, apiTarget.id));
	assert.ok(ref);
	await request("PUT", ref.valueId, tracking(ref.valueId), 404);
	check(
		(await request("DELETE", apiTarget.id, undefined, 200)).excluded,
		false,
		"API removal preserves native addressing",
	);
	await request("DELETE", apiTarget.id, undefined, 200);
	check(await eligibleForFeed(), true, "removing the exclusion restores actual feed eligibility");
} finally {
	await observability.shutdown();
}
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-recommendation-references.ts",
	"services/main/scripts/reference-merge-fixture.ts",
	"libraries/schema/src/postgres/discovery/recommendation.ts",
	"services/main/src/services/database/schema/postgres/merge-integrity.sql",
	"services/main/src/services/database/schema/postgres/unit-reference-integrity.sql",
	"services/main/src/services/database/schema/postgres/manifest.ts",
	"services/main/src/services/seed/service.ts",
	"services/main/src/services/recommendations/exclusions.ts",
	"services/main/src/services/recommendations/exclusion-query.ts",
	"services/main/src/services/api/recommendations/index.ts",
	"services/main/src/services/recommendations/units.ts",
	"services/main/src/services/api/feed/index.ts",
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
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		runtime: (
			await database.execute(
				sql`select version() as postgres,current_setting('default_transaction_isolation') as default_isolation`,
			)
		).rows[0],
		checks,
		httpChecks,
		queryEvidence,
		referenceConsumersQualified: true,
	}),
);
console.info(
	`Verified ${checks} recommendation reference assertions; transaction scenarios rolled back; API/race actors remain only on the disposable target.`,
);
process.exit(0);
