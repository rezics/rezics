import { NsfwContentLabelId } from "../src/services/bootstrap/data/content-labels";
import assert from "node:assert/strict";
import { z } from "zod";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { CatalogOwnerValues } from "@rezics/reference";
import { assertUnitPredicate, type UnitPredicate } from "@rezics/filter";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import { accountUnitTag, tag } from "@rezics/schema/postgres/knowledge/tag";
import { vocabularyNode } from "@rezics/schema/postgres/knowledge/vocabulary";
import { referenceValue } from "@rezics/schema/postgres/knowledge/reference-value";
import { accountErasure } from "@rezics/schema/postgres/access/participation";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { allocateReferenceValue } from "../src/services/units/reference-value";
import {
	compileUnitPredicateCandidateSet,
	compileUnitPredicateSql,
} from "../src/services/filter/sql";
import {
	eraseOwnAccount,
	dispatchAccountErasureBatch,
} from "../src/services/participation/erasure";
import {
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Private Tag checks require a disposable loopback target",
);
let checks = 0;
let queryEvidence: unknown;
function buffers(explain: unknown) {
	const rows = z
		.array(
			z.object({
				"QUERY PLAN": z.array(
					z.object({
						Plan: z.object({
							"Shared Hit Blocks": z.number(),
							"Shared Read Blocks": z.number(),
						}),
					}),
				),
			}),
		)
		.parse(explain);
	const root = rows[0]?.["QUERY PLAN"][0]?.Plan;
	assert.ok(root);
	return root["Shared Hit Blocks"] + root["Shared Read Blocks"];
}
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
	return { account, self, authority };
}
const rollback = new Error("rollback private Tag reference fixture");
try {
	await withDatabaseTransactionDeadline(120000, () =>
		database.transaction(async (tx) => {
			const owner = await actor(tx, "Private Tag owner"),
				other = await actor(tx, "Other Tag owner");
			const [concept] = await tx.insert(vocabularyNode).values({ kind: "concept" }).returning();
			assert.ok(concept);
			await tx.insert(tag).values({ id: concept.id });
			const ownTagReference = await allocateReferenceValue(tx, { owner: "tag", id: concept.id });
			const targets: { id: string; referenceId: string }[] = [];
			for (const ownerKind of CatalogOwnerValues) {
				const inserted = await tx.execute<{ id: string }>(
					sql`insert into ${CatalogIdentityTables[ownerKind]} (shape) values ('unknown') returning id`,
				);
				const id = inserted.rows[0]!.id;
				const referenceId = await allocateReferenceValue(tx, { owner: ownerKind, id });
				await tx.insert(accountUnitTag).values({
					authUserId: owner.account.id,
					targetReferenceId: referenceId,
					tagId: concept.id,
				});
				targets.push({ id, referenceId });
			}
			const first = targets[0]!;
			const filter: UnitPredicate = {
				tags: {
					some: {
						authority: { kind: "profile", profile: { kind: "viewer" } },
						tag: { id: { in: [concept.id] } },
					},
				},
			};
			assertUnitPredicate(filter);
			assert.throws(() =>
				assertUnitPredicate({
					tags: {
						some: {
							authority: { kind: "profile", profile: { kind: "viewer", id: owner.self.id } },
						},
					},
				}),
			);
			checks++;
			const point = (id: string, viewerProfileId?: string) =>
				compileUnitPredicateSql(filter, {
					unitId: sql`${id}::uuid`,
					unitOwner: sql`'reference'`,
					unitShape: sql`'unknown'`,
					viewerProfileId,
				});
			const matches = async (id: string, viewer?: string) =>
				(await tx.execute<{ matches: boolean }>(sql`select ${point(id, viewer)} as matches`))
					.rows[0]?.matches;
			for (const item of targets)
				check(
					await matches(item.id, owner.self.id),
					true,
					"private filter resolves each catalog owner through its canonical reference",
				);
			check(
				await matches(first.id, other.self.id),
				false,
				"another account cannot read the owner's private Tag relation",
			);
			check(await matches(first.id), false, "anonymous predicates reveal no private relationship");
			const candidateSet = compileUnitPredicateCandidateSet(filter, owner.self.id);
			assert.ok(candidateSet);
			const candidates = await tx.execute<{ unit_id: string }>(candidateSet);
			check(
				candidates.rows.map((row) => row.unit_id).sort(),
				targets.map((row) => row.id).sort(),
				"candidate projection returns native IDs, never bridge IDs",
			);
			await reject(
				tx,
				(nested) =>
					nested.insert(accountUnitTag).values({
						authUserId: owner.account.id,
						targetReferenceId: first.referenceId,
						tagId: concept.id,
					}),
				"23505",
			);
			await reject(
				tx,
				(nested) =>
					nested.insert(accountUnitTag).values({
						authUserId: owner.account.id,
						targetReferenceId: crypto.randomUUID(),
						tagId: concept.id,
					}),
				"23503",
			);
			await reject(
				tx,
				(nested) =>
					nested.insert(accountUnitTag).values({
						authUserId: owner.account.id,
						targetReferenceId: ownTagReference,
						tagId: concept.id,
					}),
				"23514",
			);
			await reject(
				tx,
				(nested) =>
					nested
						.update(accountUnitTag)
						.set({ targetReferenceId: ownTagReference })
						.where(
							and(
								eq(accountUnitTag.authUserId, owner.account.id),
								eq(accountUnitTag.targetReferenceId, first.referenceId),
							),
						),
				"23514",
			);
			await reject(
				tx,
				(nested) =>
					nested.update(tag).set({ directlyApplicable: false }).where(eq(tag.id, concept.id)),
				"23514",
			);
			const [category] = await tx.insert(vocabularyNode).values({ kind: "concept" }).returning();
			assert.ok(category);
			await tx.insert(tag).values({ id: category.id, directlyApplicable: false });
			await reject(
				tx,
				(nested) =>
					nested.insert(accountUnitTag).values({
						authUserId: owner.account.id,
						targetReferenceId: first.referenceId,
						tagId: category.id,
					}),
				"23514",
			);
			await tx
				.insert(vocabularyNode)
				.values({ id: NsfwContentLabelId, kind: "concept" })
				.onConflictDoNothing();
			await tx.insert(tag).values({ id: NsfwContentLabelId }).onConflictDoNothing();
			await reject(
				tx,
				(nested) =>
					nested.insert(accountUnitTag).values({
						authUserId: owner.account.id,
						targetReferenceId: first.referenceId,
						tagId: NsfwContentLabelId,
					}),
				"23514",
			);
			await tx.insert(accountUnitTag).values({
				authUserId: other.account.id,
				targetReferenceId: first.referenceId,
				tagId: concept.id,
			});
			check(
				await matches(first.id, other.self.id),
				true,
				"another account may independently use the same immutable target and Tag",
			);
			await runWithParticipationAuthority(owner.authority, () =>
				eraseOwnAccount(tx, owner.authority),
			);
			check(
				await matches(first.id, owner.self.id),
				false,
				"closure removes private traversal before background deletion",
			);
			await reject(
				tx,
				(nested) =>
					nested.insert(accountUnitTag).values({
						authUserId: owner.account.id,
						targetReferenceId: first.referenceId,
						tagId: concept.id,
					}),
				"23514",
			);
			for (let page = 0; page < 100; page++) {
				await tx
					.update(accountErasure)
					.set({ availableAt: new Date(0) })
					.where(eq(accountErasure.authUserId, owner.account.id));
				await dispatchAccountErasureBatch({ authUserId: owner.account.id });
				const [job] = await tx
					.select({ stage: accountErasure.stage })
					.from(accountErasure)
					.where(eq(accountErasure.authUserId, owner.account.id));
				if (job?.stage === "complete") break;
			}
			check(
				(
					await tx
						.select()
						.from(accountUnitTag)
						.where(eq(accountUnitTag.authUserId, owner.account.id))
				).length,
				0,
				"erasure removes only the closed account's private Tags",
			);
			check(
				await matches(first.id, other.self.id),
				true,
				"erasure preserves another account's matching relation",
			);
			check(
				(
					await tx
						.select({ id: referenceValue.id })
						.from(referenceValue)
						.where(eq(referenceValue.id, first.referenceId))
				).length,
				1,
				"erasure retains shared reference values",
			);
			const sampleActor = await actor(tx, "Private Tag query sample");
			const prefix = `account-tag-plan:${sampleActor.account.id}:`;
			const sampleId = sql`overlay(overlay(md5(${prefix} || i) placing '8' from 13 for 1) placing '8' from 17 for 1)::uuid`;
			for (let start = 1; start <= 10000; start += 500) {
				await tx.execute(sql`insert into public.reference_identity(id, shape)
					select ${sampleId}, 'unknown' from generate_series(${start}::integer, ${start + 499}::integer) i`);
				await tx.execute(sql`insert into public.reference_value(target_reference_id)
					select ${sampleId} from generate_series(${start}::integer, ${start + 499}::integer) i`);
				await tx.execute(sql`insert into public.account_unit_tag(auth_user_id, target_reference_id, tag_id)
					select ${sampleActor.account.id}::uuid, r.id, ${concept.id}::uuid
					from generate_series(${start}::integer, ${start + 499}::integer) i
					join public.reference_value r on r.target_reference_id = ${sampleId}`);
			}
			await tx.execute(
				sql`analyze public.account_unit_tag, public.reference_value, public.auth_entity, public.tag`,
			);
			const sample = await tx.execute<{ id: string }>(
				sql`select ${sampleId} as id from generate_series(5000,5000) i`,
			);
			const sampleTarget = sample.rows[0]!.id;
			const sampleCandidates = compileUnitPredicateCandidateSet(filter, sampleActor.self.id);
			assert.ok(sampleCandidates);
			const selectedCandidate = sql`select unit_id from (${sampleCandidates}) candidates where unit_id = ${sampleTarget}::uuid`;
			check(
				(await tx.execute<{ unit_id: string }>(selectedCandidate)).rows.map((row) => row.unit_id),
				[sampleTarget],
				"a parent native-ID condition still selects the matching candidate",
			);
			const pointPlan = await tx.execute(
				sql`explain (analyze, buffers, format json) select ${point(sampleTarget, sampleActor.self.id)}`,
			);
			const candidatePlan = await tx.execute(
				sql`explain (analyze, buffers, format json) ${selectedCandidate}`,
			);
			for (const plan of [pointPlan, candidatePlan]) {
				assert.match(JSON.stringify(plan.rows), /reference_value_native_id_idx/u);
				assert.match(JSON.stringify(plan.rows), /account_unit_tag_(?:pkey|auth_tag_idx|unit_idx)/u);
				checks++;
			}
			let withoutNativeIndex: unknown;
			const restoreIndex = new Error("restore native projection index after bounded comparison");
			await assert.rejects(
				tx.transaction(async (nested) => {
					await nested.execute(sql`drop index public.reference_value_native_id_idx`);
					withoutNativeIndex = (
						await nested.execute(sql`explain (analyze, buffers, format json) ${selectedCandidate}`)
					).rows;
					throw restoreIndex;
				}),
				(cause) => cause === restoreIndex,
			);
			check(
				buffers(candidatePlan.rows) < buffers(withoutNativeIndex),
				true,
				"the native projection index reduces buffer work for the bounded candidate lookup",
			);
			const footprint =
				await tx.execute(sql`select count(*)::integer as rows, avg(pg_column_size(t))::numeric(10,2) as tuple_bytes,
				pg_table_size('public.account_unit_tag') as heap_bytes, pg_indexes_size('public.account_unit_tag') as index_bytes
				from public.account_unit_tag t where auth_user_id = ${sampleActor.account.id}::uuid`);
			check(
				footprint.rows[0]?.rows,
				10000,
				"bounded hot-account sample contains every requested assignment",
			);
			queryEvidence = {
				sample: footprint.rows[0],
				pointPlan: pointPlan.rows,
				candidatePlan: candidatePlan.rows,
				withoutNativeIndex,
			};
			throw rollback;
		}),
	);
} catch (cause) {
	if (cause !== rollback) throw cause;
}
const repository = new URL("../../../", import.meta.url);
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/Taskfile.yml",
	"services/main/scripts/check-account-tag-references.ts",
	"services/main/src/services/filter/sql.ts",
	"services/main/src/services/seed/service.ts",
	"services/main/src/services/units/reference-value.ts",
	"services/main/src/services/units/immutable-reference.ts",
	"services/main/src/services/participation/account-query.ts",
	"services/main/src/services/participation/erasure.ts",
	"libraries/schema/src/postgres/knowledge/tag.ts",
	"libraries/schema/src/postgres/knowledge/reference-value.ts",
	"libraries/schema/src/postgres/shared/unit-reference-columns.ts",
	"services/main/src/services/database/schema/postgres/account-tag-reference.sql",
	"services/main/src/services/database/schema/postgres/content-label-policy.sql",
	"services/main/src/services/database/schema/postgres/participation-private-state.sql",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
const runtime =
	await database.execute(sql`select version() as postgres, current_setting('default_transaction_isolation') as default_isolation,
	current_setting('shared_buffers') as shared_buffers`);
console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		runtime: runtime.rows[0],
		checks,
		queryEvidence,
	}),
);
console.info(
	`Verified ${checks} private Tag reference and filter assertions on PostgreSQL; fixture rows rolled back.`,
);
process.exit(0);
