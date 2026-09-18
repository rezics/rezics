import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { issueParticipationGrant } from "../src/services/participation/commands";
import {
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import { createEntity } from "../src/services/catalog/entities";
import { createReference } from "../src/services/catalog/references";
import { ensureCatalogDefinition } from "../src/services/catalog/storage";
import {
	createNativeSoftwareContent,
	createNativeSoftwareRelease,
	createSoftwareVersion,
	appendSoftwareReleaseComponents,
	readSoftwareReleaseComponents,
	readSoftwareHistory,
	readSoftwareComponentHistory,
	findSoftwareReleases,
} from "../src/services/catalog/software";
import {
	createSoftwareParticipation,
	readSoftwareParticipations,
	readSoftwareParticipationHistory,
} from "../src/services/catalog/software-participation";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname)
)
	throw new Error("Requires isolated loopback Atlas target");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20000 }),
	database = drizzle({ client: pool });
const rollback = new Error("rollback software read scope fixture");
let assertions = 0;
try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Software read scope fixture",
					email: `${crypto.randomUUID()}@example.invalid`,
					emailVerified: true,
				})
				.returning();
			assert.ok(account);
			const self = await ensureSelfEntityInTransaction(tx, account);
			const authority: ParticipationAuthority = {
				principal: { kind: "auth", authUserId: account.id },
				actingEntityId: self.id,
				authorizationRevision: self.authorizationRevision,
			};
			await runWithParticipationAuthority(authority, async () => {
				const content = await createNativeSoftwareContent(tx, account.id, {
					name: { value: "Private content", languageTag: null },
				});
				const version = await createSoftwareVersion(tx, account.id, {
					content,
					name: { value: "Private revision", languageTag: null },
					details: {
						kind: "revision",
						versionLabel: "1",
						distinguishingEvidence: "A separately built revision",
					},
				});
				const release = await createNativeSoftwareRelease(tx, account.id, {
					name: { value: "Private patch", languageTag: null },
					details: { isPatch: true },
				});
				const base = await createNativeSoftwareRelease(tx, account.id, {
					name: { value: "Private base", languageTag: null },
				});
				const area = await createReference(tx, account.id, {
					name: { value: "Private area", languageTag: null },
					profile: { shape: "area" },
				});
				const components = await appendSoftwareReleaseComponents(
					tx,
					release,
					account.id,
					release.revision,
					[
						{ kind: "content", contentId: content.id, versionId: version.id },
						{ kind: "patch_target", baseReleaseId: base.id },
						{ kind: "event", areaId: area.id, date: { year: 2000, month: null, day: null } },
						{ kind: "event", areaId: null, date: { year: 2001, month: null, day: null } },
					],
				);
				const [membershipId, , privateEventId, openEventId] = components.ids;
				assert.ok(membershipId && privateEventId && openEventId);
				const credited = await createEntity(tx, account.id, {
					shape: "person",
					name: { value: "Private actor", languageTag: null },
				});
				const character = await createEntity(tx, account.id, {
					shape: "character",
					name: { value: "Private character", languageTag: null },
				});
				const role = await ensureCatalogDefinition(tx, {
					namespace: "catalog.participation_role",
					key: "voice_actor",
					kind: "vocabulary",
					valueKind: null,
				});
				const credit = await createSoftwareParticipation(tx, content, account.id, {
					entityId: credited.id,
					characterId: character.id,
					name: null,
					context: null,
					roleRevisionId: role.revisionId,
					note: null,
					state: "active",
				});
				assert.equal(
					(await readSoftwareReleaseComponents(tx, release, account.id, "content")).length,
					1,
				);
				assertions++;
				assert.equal((await findSoftwareReleases(tx, content, account.id, {})).length, 1);
				assertions++;
				assert.equal((await readSoftwareParticipations(tx, content, account.id)).length, 1);
				assertions++;
				const select = async (reference: typeof release, work: () => Promise<void>) => {
					const grant = await issueParticipationGrant(tx, authority, {
						recipient: { kind: "auth", authUserId: account.id },
						actingEntityId: authority.actingEntityId,
						capability: "catalog.edit",
						target: { owner: reference.owner, id: reference.id },
					});
					await runWithParticipationAuthority({ ...authority, grant }, work);
				};
				await select(release, async () => {
					assert.equal(
						(await readSoftwareReleaseComponents(tx, release, account.id, "content")).length,
						0,
					);
					assertions++;
					assert.equal(
						(await readSoftwareReleaseComponents(tx, release, account.id, "patch_target")).length,
						0,
					);
					assertions++;
					const events = await readSoftwareReleaseComponents(tx, release, account.id, "event", {
						limit: 1,
					});
					assert.equal(events.length, 1);
					assertions++;
					assert.ok(events[0] && "areaId" in events[0] && events[0].areaId === null);
					assertions++;
					assert.ok((await readSoftwareHistory(tx, release, account.id)).length > 0);
					assertions++;
					assert.equal(
						(await readSoftwareComponentHistory(tx, release, account.id, "content", membershipId))
							.length,
						0,
					);
					assertions++;
					assert.equal(
						(await readSoftwareComponentHistory(tx, release, account.id, "event", privateEventId))
							.length,
						0,
					);
					assertions++;
					assert.equal(
						(await readSoftwareComponentHistory(tx, release, account.id, "event", openEventId))
							.length,
						1,
					);
					assertions++;
					await assert.rejects(() => readSoftwareHistory(tx, base, account.id));
					assertions++;
				});
				await select(content, async () => {
					assert.equal((await findSoftwareReleases(tx, content, account.id, {})).length, 0);
					assertions++;
					assert.equal((await readSoftwareParticipations(tx, content, account.id)).length, 0);
					assertions++;
					assert.equal(
						(
							await readSoftwareParticipationHistory(
								tx,
								content,
								account.id,
								credit.participationId,
							)
						).length,
						0,
					);
					assertions++;
				});
				await select(version, async () => {
					assert.equal((await readSoftwareHistory(tx, version, account.id)).length, 0);
					assertions++;
				});
				assert.equal(
					(await readSoftwareParticipationHistory(tx, content, account.id, credit.participationId))
						.length,
					1,
				);
				assertions++;
				assert.equal(
					(await readSoftwareComponentHistory(tx, release, account.id, "content", membershipId))
						.length,
					1,
				);
				assertions++;
				await tx.execute(sql`set constraints all immediate`);
			});
			throw rollback;
		});
	} catch (error) {
		if (error !== rollback) throw error;
	}
	console.log(JSON.stringify({ check: "software-read-scope", assertions, rolledBack: true }));
} finally {
	await pool.end();
}
