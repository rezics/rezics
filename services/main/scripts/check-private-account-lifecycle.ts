import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { checkFavoriteQueryPlans } from "./check-favorite-query-plans";
import { checkFavoriteConcurrency } from "./check-favorite-concurrency";
import { and, eq, sql } from "drizzle-orm";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import { accountErasure } from "../src/services/database/schema/participation";
import {
	accountFavorite,
	accountFavoriteRevision,
	accountFavoritesState,
} from "../src/services/database/schema/favorites";
import { FavoriteNotFound } from "../src/services/favorites/errors";
import { referenceValue } from "../src/services/database/schema/reference-value";
import { findReferenceValueByNativeId } from "../src/services/units/reference-value";
import { catalogUnitLocator } from "../src/services/database/schema/catalog-identity";
import { accountFollowPreference, unitFollow } from "../src/services/database/schema/follow";
import { imageAsset, imageObject } from "../src/services/database/schema/image";
import { post } from "../src/services/database/schema/post";
import { Authorization } from "../src/services/authorization";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import {
	eraseOwnAccount,
	dispatchAccountErasureBatch,
} from "../src/services/participation/erasure";
import {
	readFavorite,
	saveFavorite,
	deleteFavorite,
	listFavorites,
	listFavoriteHistory,
	readFavoriteRevision,
} from "../src/services/favorites/service";
import {
	followUnit,
	listFollowing,
	updateFollowingPresentation,
} from "../src/services/following/service";
import type { ImageErasureArchive } from "../src/services/image-assets/erasure";
import {
	createManagedOrganization,
	listManagedOrganizations,
} from "../src/services/participation/organizations";
import {
	issueParticipationGrant,
	listManagedEntityGrants,
} from "../src/services/participation/commands";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1" ||
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error(
		"Private lifecycle qualification requires an explicit disposable loopback rezics_atlas target",
	);

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

let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
let queryPlans: Awaited<ReturnType<typeof checkFavoriteQueryPlans>> | undefined;
const concurrency = await checkFavoriteConcurrency(target.toString());
const rollback = new Error("rollback private lifecycle fixture");
try {
	await withDatabaseTransactionDeadline(120_000, async () => {
		await database.transaction(async (tx) => {
			const human = await actor(tx, "Private lifecycle owner");
			const other = await actor(tx, "Unrelated private owner");
			const humanAuthorization = new Authorization(
				human.self.id,
				human.account.id,
				human.authority,
			);
			const otherAuthorization = new Authorization(
				other.self.id,
				other.account.id,
				other.authority,
			);
			const organization = await runWithParticipationAuthority(human.authority, () =>
				createManagedOrganization(tx, human.authority, {
					name: "Lifecycle organization",
					language: "en",
				}),
			);
			check(
				(await listManagedOrganizations(tx, human.account.id)).items[0]?.name,
				"Lifecycle organization",
				"managed identities project public names without per-row requests",
			);
			const security = organization.grants.find((grant) => grant.capability === "entity.security");
			assert.ok(security);
			const organizationAuthority: ParticipationAuthority = {
				...human.authority,
				actingEntityId: organization.entityId,
				grant: { id: security.id, revision: security.revision },
			};
			await issueParticipationGrant(tx, organizationAuthority, {
				recipient: { kind: "auth", authUserId: other.account.id },
				actingEntityId: organization.entityId,
				capability: "entity.publish",
				target: { owner: "entity", id: organization.entityId },
			});
			const managedGrants = await listManagedEntityGrants(
				tx,
				organizationAuthority,
				organization.entityId,
			);
			check(
				managedGrants.length,
				4,
				"exact security authority reads grants issued to other principals",
			);
			check(
				managedGrants.find((row) => row.accountEntityId === other.self.id)?.recipientName,
				"Unrelated private owner",
				"grant recipients use their public names",
			);
			await assert.rejects(
				tx.transaction((nested) =>
					listManagedEntityGrants(nested, other.authority, organization.entityId),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					listManagedEntityGrants(nested, organizationAuthority, other.self.id),
				),
			);
			checks++;
			const targets = await tx
				.insert(post)
				.values(
					Array.from({ length: 515 }, (_, index) => ({
						kind: "post" as const,
						status: "published" as const,
						publishedAt: new Date(),
						visibility: index < 512 ? ("private" as const) : ("public" as const),
					})),
				)
				.returning({ id: post.id });
			const first = targets[512]!.id,
				second = targets[513]!.id;
			await tx
				.insert(unitFollow)
				.values(targets.map(({ id }) => ({ followerProfileId: human.self.id, unitId: id })));
			// Stable lexical ordering deliberately puts 512 filtered candidates before readable targets.
			await tx.insert(accountFollowPreference).values(
				targets.map(({ id }, index) => ({
					authUserId: human.account.id,
					followerEntityId: human.self.id,
					unitId: id,
					position: `a0${String(index).padStart(5, "0")}V`,
				})),
			);
			const page = await listFollowing({
				authUserId: human.account.id,
				followerProfileId: human.self.id,
				limit: 30,
				authorization: humanAuthorization.unit,
			});
			check(page.items.length, 0, "filtered scan returns no inaccessible targets");
			assert.ok(page.nextCursor);
			checks++;
			const next = await listFollowing({
				authUserId: human.account.id,
				followerProfileId: human.self.id,
				limit: 30,
				cursor: page.nextCursor,
				authorization: humanAuthorization.unit,
			});
			check(
				next.items.length,
				3,
				"cursor advances past filtered candidates using only the preference table",
			);
			await updateFollowingPresentation(human.account.id, human.self.id, first, { favorite: true });
			await assert.rejects(() =>
				updateFollowingPresentation(other.account.id, human.self.id, first, { favorite: false }),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested.insert(accountFollowPreference).values({
						authUserId: other.account.id,
						followerEntityId: human.self.id,
						unitId: first,
					}),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested.insert(accountFollowPreference).values({
						authUserId: other.account.id,
						followerEntityId: other.self.id,
						unitId: first,
					}),
				),
			);
			checks++;
			await followUnit({
				authUserId: other.account.id,
				followerProfileId: other.self.id,
				unitId: first,
				authorization: otherAuthorization.unit,
			});
			check(
				(await readFavorite(tx, human.authority, first)).entry,
				null,
				"exact read represents absent favorite without scanning the account",
			);
			for (const deniedTarget of [targets[0]!.id, crypto.randomUUID()]) {
				await assert.rejects(
					tx.transaction((nested) =>
						saveFavorite(nested, human.authority, deniedTarget, {
							expectedRevision: 0,
						}),
					),
					FavoriteNotFound,
				);
				check(
					await findReferenceValueByNativeId(tx, deniedTarget),
					undefined,
					"denied saves do not allocate canonical references or reveal target existence",
				);
			}
			const saved = await saveFavorite(tx, human.authority, first, {
				expectedRevision: 0,
				note: "Private note survives restore",
			});
			check(saved.entry.target.owner, "post", "favorite retains its concrete owner reference");
			await assert.rejects(
				tx.transaction((nested) =>
					saveFavorite(nested, human.authority, second, { expectedRevision: 0 }),
				),
			);
			checks++;
			const savedReference = await findReferenceValueByNativeId(tx, first);
			assert.ok(savedReference);
			check(
				savedReference.target,
				{ owner: "post", id: first },
				"canonical target is independently resolvable",
			);
			const [storedHistory] = await tx
				.select()
				.from(accountFavoriteRevision)
				.where(eq(accountFavoriteRevision.authUserId, human.account.id));
			check(
				Object.hasOwn(storedHistory?.snapshot ?? {}, "target"),
				false,
				"private history has no independently writable target inside its payload",
			);
			await assert.rejects(
				tx.transaction((nested) =>
					nested.insert(accountFavoriteRevision).values({
						authUserId: human.account.id,
						revision: 999,
						targetReferenceId: crypto.randomUUID(),
						operation: "delete",
						snapshot: null,
					}),
				),
				(cause: unknown) => {
					while (cause instanceof Error && cause.cause) cause = cause.cause;
					return (
						typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23503"
					);
				},
			);
			checks++;
			for (const invalid of [
				{ operation: "save" as const, snapshot: null },
				{ operation: "delete" as const, snapshot: {} },
				{ operation: "save" as const, snapshot: { target: { owner: "post", id: first } } },
			]) {
				await assert.rejects(
					tx.transaction((nested) =>
						nested.insert(accountFavoriteRevision).values({
							authUserId: human.account.id,
							revision: 999,
							targetReferenceId: savedReference.valueId,
							...invalid,
						}),
					),
					(cause: unknown) => {
						while (cause instanceof Error && cause.cause) cause = cause.cause;
						return (
							typeof cause === "object" &&
							cause !== null &&
							"code" in cause &&
							cause.code === "23514"
						);
					},
				);
				checks++;
			}
			const observationRollback = new Error("rollback temporary visibility and routing changes");
			await assert.rejects(
				tx.transaction(async (nested) => {
					await nested.update(post).set({ visibility: "private" }).where(eq(post.id, first));
					check(
						(await readFavorite(nested, human.authority, first)).entry?.preview,
						saved.entry.preview,
						"captured private preview remains available to its account after visibility changes",
					);
					await assert.rejects(
						nested.transaction((attempt) =>
							saveFavorite(attempt, human.authority, first, {
								expectedRevision: 1,
								refreshPreview: true,
							}),
						),
						FavoriteNotFound,
					);
					await assert.rejects(
						nested.transaction((attempt) =>
							saveFavorite(attempt, other.authority, first, {
								expectedRevision: 0,
							}),
						),
						FavoriteNotFound,
					);
					checks += 2;
					await nested.delete(catalogUnitLocator).where(eq(catalogUnitLocator.id, first));
					check(
						(await readFavoriteRevision(nested, human.authority, first, 1)).snapshot?.target,
						{ owner: "post", id: first },
						"history derives exact native identity without the routing projection",
					);
					check(
						(await listFavorites(nested, human.authority, {})).items[0]?.target,
						{ owner: "post", id: first },
						"bounded joined reads survive routing projection absence",
					);
					throw observationRollback;
				}),
				(error) => error === observationRollback,
			);
			await saveFavorite(tx, human.authority, second, { expectedRevision: 1 });
			await deleteFavorite(tx, human.authority, first, 2);
			await saveFavorite(tx, human.authority, first, { expectedRevision: 3 }, 1);
			check(
				(await readFavorite(tx, human.authority, first)).entry?.note,
				"Private note survives restore",
				"restoration keeps private note",
			);
			const selectedOrganization = { ...human.authority, actingEntityId: other.self.id };
			check(
				(await listFavorites(tx, selectedOrganization, {})).items.length,
				2,
				"acting identity does not transfer private ownership",
			);
			check(
				(await listFavorites(tx, other.authority, {})).items.length,
				0,
				"another account cannot read private favorites",
			);
			check(
				(await listFavoriteHistory(tx, human.authority, first)).items.map((item) => item.operation),
				["restore", "delete", "save"],
				"private history records actual operations",
			);
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.delete(accountFavoriteRevision)
						.where(eq(accountFavoriteRevision.authUserId, human.account.id)),
				),
			);
			checks++;
			// More than one history batch proves the worker cannot declare completion at its first bounded delete.
			let revision = 4;
			for (let index = 0; index < 36; index++)
				await saveFavorite(tx, human.authority, first, {
					expectedRevision: revision++,
					note: `Private revision ${index}`,
				});
			await saveFavorite(tx, other.authority, first, {
				expectedRevision: 0,
				note: "Unrelated account note",
			});
			const sharedReferences = await tx
				.select({ referenceId: accountFavorite.targetReferenceId })
				.from(accountFavorite)
				.where(eq(accountFavorite.targetReferenceId, savedReference.valueId));
			check(
				sharedReferences.length,
				2,
				"independent accounts reuse one canonical target without sharing private state",
			);
			await assert.rejects(
				tx.transaction((nested) =>
					nested
						.update(accountFavorite)
						.set({ targetReferenceId: crypto.randomUUID(), revision: revision + 1 })
						.where(eq(accountFavorite.authUserId, human.account.id)),
				),
			);
			checks++;
			const [asset] = await tx
				.insert(imageAsset)
				.values({
					ownerAuthUserId: human.account.id,
					uploaderAuthUserId: human.account.id,
					access: "private",
					status: "pending",
				})
				.returning();
			assert.ok(asset);
			const original = `image-objects/${asset.id}/original`;
			await tx.insert(imageObject).values({ assetId: asset.id, storageKey: original });
			let objects = Array.from({ length: 502 }, (_, index) => ({
				key: index ? `image-objects/${asset.id}/derived/${index}` : original,
				versionId: "old",
				size: 8,
			}));
			const archive: ImageErasureArchive = {
				put: async () => {
					objects.unshift({ key: original, versionId: "fence", size: 0 });
					return { VersionId: "fence", $metadata: {} };
				},
				listErasurePage: async () => ({
					objects: objects.slice(0, 500),
					truncated: objects.length > 500,
				}),
				deleteErasurePage: async (batch) => {
					assert.ok(batch.length <= 500);
					const keys = new Set(batch.map((row) => `${row.key}:${row.versionId}`));
					objects = objects.filter((row) => !keys.has(`${row.key}:${row.versionId}`));
				},
			};
			await runWithParticipationAuthority(human.authority, () =>
				eraseOwnAccount(tx, human.authority),
			);
			await assert.rejects(
				tx.transaction((nested) =>
					saveFavorite(nested, human.authority, first, { expectedRevision: revision }),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested.insert(imageObject).values({ assetId: asset.id, storageKey: `${original}-late` }),
				),
			);
			checks++;
			await assert.rejects(
				tx.transaction((nested) =>
					nested.insert(accountFollowPreference).values({
						authUserId: human.account.id,
						followerEntityId: human.self.id,
						unitId: first,
					}),
				),
			);
			checks++;
			let complete = false;
			for (let index = 0; index < 100; index++) {
				await tx
					.update(accountErasure)
					.set({ availableAt: new Date(0) })
					.where(eq(accountErasure.authUserId, human.account.id));
				const removed = await dispatchAccountErasureBatch({
					authUserId: human.account.id,
					archive,
				});
				assert.ok(removed <= 500);
				const [job] = await tx
					.select()
					.from(accountErasure)
					.where(eq(accountErasure.authUserId, human.account.id));
				if (job?.stage === "complete") {
					complete = true;
					check(job.priorEmail, null, "completed erasure removes email routing evidence");
					break;
				}
			}
			check(complete, true, "durable erasure runs all bounded lifecycle stages");
			for (const table of [
				accountFavorite,
				accountFavoriteRevision,
				accountFavoritesState,
				accountFollowPreference,
			]) {
				const rows = await tx.execute<{ count: string }>(
					sql`select count(*)::text as count from ${table} where ${table.authUserId} = ${human.account.id}::uuid`,
				);
				check(rows.rows[0]?.count, "0", "private state is erased");
			}
			check(
				(await tx.select().from(unitFollow).where(eq(unitFollow.followerProfileId, human.self.id)))
					.length,
				515,
				"public Entity follows remain independent of private preference erasure",
			);
			check(
				(await readFavorite(tx, other.authority, first)).entry?.note,
				"Unrelated account note",
				"another account remains intact",
			);
			check(
				(
					await tx
						.select({ id: referenceValue.id })
						.from(referenceValue)
						.where(eq(referenceValue.id, savedReference.valueId))
				).length,
				1,
				"account erasure removes private rows while shared immutable reference values survive",
			);
			check(
				objects,
				[{ key: original, versionId: "fence", size: 0 }],
				"mock archive drains versions and retains only its empty upload fence",
			);
			const [erasedAsset] = await tx
				.select()
				.from(imageAsset)
				.where(and(eq(imageAsset.id, asset.id), eq(imageAsset.ownerAuthUserId, human.account.id)));
			assert.ok(erasedAsset?.contentErasedAt);
			checks++;
			check(
				(
					await tx.execute<{
						favorites: number;
					}>(sql`select favorites::integer from public.unit_engagement_stat
				where unit_id = ${first}::uuid`)
				).rows[0]?.favorites,
				1,
				"reference-backed aggregate accounting retains only the unrelated account's favorite",
			);
			const sampleAccount = await actor(tx, "Favorite query sample");
			queryPlans = await checkFavoriteQueryPlans(tx, sampleAccount.account.id);
			throw rollback;
		});
	});
} catch (cause) {
	if (cause !== rollback) {
		let detail: unknown = cause;
		while (detail instanceof Error && detail.cause) detail = detail.cause;
		console.error(detail);
		process.exit(1);
	}
}
const repository = new URL("../../../", import.meta.url);
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/Taskfile.yml",
	"services/main/scripts/check-private-account-lifecycle.ts",
	"services/main/scripts/check-favorite-concurrency.ts",
	"services/main/scripts/unit-access-fixture.ts",
	"services/main/scripts/check-favorite-query-plans.ts",
	"services/main/src/services/favorites/service.ts",
	"services/main/src/services/favorites/contracts.ts",
	"services/main/src/services/units/reference-value.ts",
	"services/main/src/services/units/reference.ts",
	"services/main/src/services/authorization/unit/access-lock.ts",
	"services/main/src/services/authorization/unit/authorization.ts",
	"services/main/src/services/participation/erasure.ts",
	"services/main/src/services/image-assets/erasure.ts",
	"services/main/src/services/database/schema/favorites.ts",
	"services/main/src/services/database/schema/reference-value.ts",
	"services/main/src/services/database/schema/postgres/participation-private-state.sql",
	"services/main/src/services/database/schema/postgres/reference-value.sql",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
const runtime = await database.execute(sql`select version() as postgres,
	current_setting('default_transaction_isolation') as default_isolation,
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
		concurrency,
		queryPlans,
	}),
);
console.info(
	`Verified ${checks} private account lifecycle assertions on real PostgreSQL; image archive is an in-memory test double; private lifecycle rows rolled back; concurrency actors remain only in this disposable target.`,
);
process.exit(0);
