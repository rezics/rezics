import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import {
	softwareRelease,
	softwareRecordRevision,
} from "../src/services/database/schema/catalog-software";
import { ensureCatalogDefinition } from "../src/services/catalog/storage";
import {
	createNativeSoftwareContent,
	createNativeSoftwareRelease,
	createSoftwareVersion,
	appendSoftwareReleaseComponents,
	readSoftwareReleaseComponents,
	findSoftwareReleases,
	reviseSoftwareRelease,
	restoreSoftwareDetails,
	readSoftwareHistory,
	removeSoftwareReleaseComponent,
	readSoftwareComponentHistory,
} from "../src/services/catalog/software";
import {
	readSoftwareAnimation,
	setSoftwareAnimation,
	vndbAnimation,
} from "../src/services/catalog/software-animation";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/.test(url.pathname)
)
	throw new Error("Software checks require a loopback disposable Atlas database");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback software native fixture");
let assertions = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [actor] = await tx
				.insert(users)
				.values({
					name: "Software native fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
				})
				.returning({ id: users.id });
			assert.ok(actor);
			const content = await createNativeSoftwareContent(tx, actor.id, {
				name: { value: "Native visual novel", languageTag: "en" },
				visualNovel: true,
				details: { originalLanguageTag: "ja", developmentStatus: "finished" },
			});
			const other = await createNativeSoftwareContent(tx, actor.id, {
				name: { value: "Other content", languageTag: null },
			});
			const version = await createSoftwareVersion(tx, actor.id, {
				content,
				name: { value: "Korean translation", languageTag: "en" },
				details: {
					kind: "translation",
					languageTag: "ko",
					distinguishingEvidence: "Publisher identifies separately revised Korean script",
				},
			});
			const release = await createNativeSoftwareRelease(tx, actor.id, {
				name: { value: "Korean physical release", languageTag: "en" },
				details: {
					isPatch: false,
					resolution: { kind: "pixels", width: 1280, height: 720 },
					date: { year: 2024, month: 2, day: 29 },
				},
			});
			const platform = await ensureCatalogDefinition(tx, {
				namespace: "software.platform",
				key: "windows",
				kind: "vocabulary",
				valueKind: null,
			});
			const medium = await ensureCatalogDefinition(tx, {
				namespace: "software.medium",
				key: "dvd",
				kind: "vocabulary",
				valueKind: null,
			});
			let revision = (
				await appendSoftwareReleaseComponents(tx, release, actor.id, release.revision, [
					{ kind: "content", contentId: content.id, versionId: version.id },
					{ kind: "platform", platformRevisionId: platform.revisionId },
					{ kind: "medium", mediumTypeRevisionId: medium.revisionId, quantity: 2 },
					{
						kind: "language",
						languageTag: "ko",
						machineTranslated: false,
						main: true,
						title: "한국어판",
					},
				])
			).revision;
			assert.equal(
				(
					await findSoftwareReleases(tx, content, actor.id, {
						languageTag: "ko",
						machineTranslated: false,
						platformRevisionId: platform.revisionId,
						mediumTypeRevisionId: medium.revisionId,
					})
				).length,
				1,
			);
			assertions++;
			assert.equal(
				(
					await findSoftwareReleases(tx, content, actor.id, {
						languageTag: "ko",
						machineTranslated: true,
					})
				).length,
				0,
			);
			assertions++;
			await assert.rejects(
				tx.transaction((inner) =>
					appendSoftwareReleaseComponents(inner, release, actor.id, revision, [
						{ kind: "content", contentId: other.id, versionId: version.id },
					]),
				),
			);
			assertions++;
			await assert.rejects(
				tx.transaction((inner) =>
					appendSoftwareReleaseComponents(inner, release, actor.id, revision, [
						{ kind: "patch_target", baseReleaseId: release.id },
					]),
				),
			);
			assertions++;
			await assert.rejects(
				tx.transaction((inner) =>
					reviseSoftwareRelease(inner, release, actor.id, revision - 1, { engine: "stale" }),
				),
			);
			assertions++;
			const before = await readSoftwareHistory(tx, release, actor.id);
			assert.equal(before[0]?.revision, 1);
			assertions++;
			revision = (
				await reviseSoftwareRelease(tx, release, actor.id, revision, {
					engine: "Native engine",
					resolution: { kind: "non_standard" },
				})
			).revision;
			assert.equal((await readSoftwareHistory(tx, release, actor.id))[0]?.revision, revision);
			assertions++;
			revision = (await restoreSoftwareDetails(tx, release, actor.id, revision, 1)).revision;
			const [restored] = await tx
				.select()
				.from(softwareRelease)
				.where(eq(softwareRelease.id, release.id));
			assert.equal(restored?.resolutionWidth, 1280);
			assert.equal(restored?.dateDay, 29);
			assertions += 2;
			await assert.rejects(
				tx.transaction((inner) =>
					inner
						.update(softwareRecordRevision)
						.set({ shape: "content" })
						.where(eq(softwareRecordRevision.ownerId, release.id)),
				),
			);
			assertions++;
			await assert.rejects(
				tx.transaction((inner) =>
					inner.execute(
						sql`insert into software_record_revision(owner_id,revision,shape,value) values (${release.id},999,'release','{}'::jsonb)`,
					),
				),
			);
			assertions++;
			const media = await readSoftwareReleaseComponents(tx, release, actor.id, "medium");
			const mediumId = media[0] && "id" in media[0] ? media[0].id : null;
			assert.ok(mediumId);
			revision = (
				await removeSoftwareReleaseComponent(tx, release, actor.id, revision, "medium", mediumId)
			).revision;
			assert.deepEqual(
				(await readSoftwareComponentHistory(tx, release, actor.id, "medium", mediumId)).map(
					(row) => row.operation,
				),
				["remove", "put"],
			);
			assertions++;
			assert.equal(
				(await readSoftwareReleaseComponents(tx, release, actor.id, "medium")).length,
				0,
			);
			assertions++;
			revision = (
				await setSoftwareAnimation(
					tx,
					release,
					actor.id,
					revision,
					vndbAnimation("story_sprite", 4 + 256),
				)
			).revision;
			assert.equal((await readSoftwareAnimation(tx, release, actor.id))[0]?.frequency, "some");
			assertions++;
			assert.ok(revision > release.revision);
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(JSON.stringify({ check: "software-native", assertions, rolledBack: true }));
} finally {
	await pool.end();
}
