import assert from "node:assert/strict";
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
import { accountFollowPreference, unitFollow } from "../src/services/database/schema/follow";
import { imageAsset, imageObject } from "../src/services/database/schema/image";
import { unit } from "../src/services/database/schema/unit";
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
} from "../src/services/favorites/service";
import {
	followUnit,
	listFollowing,
	updateFollowingPresentation,
} from "../src/services/following/service";
import type { ImageErasureArchive } from "../src/services/image-assets/erasure";

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
const rollback = new Error("rollback private lifecycle fixture");
try {
	await withDatabaseTransactionDeadline(120_000, async () => {
		await database.transaction(async (tx) => {
			const human = await actor(tx, "Private lifecycle owner");
			const other = await actor(tx, "Unrelated private owner");
			const targets = await tx
				.insert(unit)
				.values(
					Array.from({ length: 515 }, (_, index) => ({
						kind: "book" as const,
						status: "published" as const,
						publishedAt: new Date(),
						visibility: index < 512 ? ("private" as const) : ("public" as const),
					})),
				)
				.returning({ id: unit.id });
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
			});
			check(page.items.length, 0, "filtered scan returns no inaccessible targets");
			assert.ok(page.nextCursor);
			checks++;
			const next = await listFollowing({
				authUserId: human.account.id,
				followerProfileId: human.self.id,
				limit: 30,
				cursor: page.nextCursor,
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
				authorization: { ensureCanRead: async () => undefined },
			});
			check(
				(await readFavorite(tx, human.authority, first)).entry,
				null,
				"exact read represents absent favorite without scanning the account",
			);
			const saved = await saveFavorite(tx, human.authority, first, {
				expectedRevision: 0,
				note: "Private note survives restore",
			});
			check(saved.entry.preview.kind, "book", "preview carries authoritative navigation kind");
			await assert.rejects(
				tx.transaction((nested) =>
					saveFavorite(nested, human.authority, second, { expectedRevision: 0 }),
				),
			);
			checks++;
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
console.info(
	`Verified ${checks} private account lifecycle assertions on real PostgreSQL; image archive is an in-memory test double; all SQL fixture rows rolled back.`,
);
process.exit(0);
