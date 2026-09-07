import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "../src/services/database/schema/auth";
import {
	musicMedium,
	musicReleaseGroup,
	musicWork,
} from "../src/services/database/schema/catalog-music";
import { musicIdentity } from "../src/services/database/schema/catalog-identity";
import {
	addMusicMedium,
	addMusicTrack,
	addReleaseDate,
	createArea,
	createMusicalWork,
	createMusicRelease,
	createMusicCredit,
	createReleaseGroup,
} from "../src/services/catalog/domains";
import {
	addMusicReleaseLabel,
	addMusicReleasePresentation,
	addMusicMediumPresentation,
	addMusicTrackPresentation,
	attachMusicDiscToc,
	editMusicMedium,
	editMusicReleaseEvent,
	editMusicReleaseMetadata,
	listMusicDiscTocs,
	listMusicMedia,
	listMusicReleasePresentations,
	listMusicMediumPresentations,
	listMusicTrackPresentations,
	listMusicReleaseEvents,
	listMusicReleaseGroupSecondaryTypes,
	listMusicReleaseLabels,
	listMusicWorkLanguages,
	readMusicDiscToc,
	readMusicReleaseMetadata,
	removeMusicReleaseLabel,
	setMusicReleaseGroupPrimaryType,
	setMusicReleaseGroupSecondaryType,
	setMusicWorkLanguage,
	setMusicWorkType,
} from "../src/services/catalog/music-domain";
import {
	CatalogAccessDenied,
	CatalogReferenceNotFound,
	CatalogRevisionConflict,
	createCatalogIdentity,
	ensureCatalogDefinition,
} from "../src/services/catalog/storage";
import {
	addMusicMediumAttribute,
	installReviewedMusicMediumPolicy,
	listMusicMediumAttributes,
	removeMusicMediumAttribute,
} from "../src/services/catalog/music-medium-attributes";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable-fixture configuration is required");
const url = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	url.pathname !== `/${process.env.REZICS_CATALOG_FIXTURE_DATABASE ?? "rezics_atlas"}` ||
	url.port !== (process.env.REZICS_CATALOG_FIXTURE_PORT ?? "25434")
)
	throw new Error("Native music acceptance requires explicitly selected isolated PostgreSQL");
const pool = new Pool({ connectionString, max: 1, statement_timeout: 20_000 });
const database = drizzle({ client: pool });
const rollback = new Error("rollback native music acceptance");
try {
	try {
		await database.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({ name: "Native music fixture", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			const [outsider] = await tx
				.insert(users)
				.values({ name: "Other fixture actor", email: `${crypto.randomUUID()}@example.invalid` })
				.returning({ id: users.id });
			assert.ok(account);
			assert.ok(outsider);
			const actor = account.id;
			const name = { languageTag: "en", value: "Independent physical release" };
			const release = await createMusicRelease(tx, actor, { name });
			let version = release.revision;
			const vocabulary = await ensureCatalogDefinition(tx, {
				namespace: "fixture.music",
				key: "native",
				kind: "vocabulary",
				valueKind: null,
			});
			const otherVocabulary = await ensureCatalogDefinition(tx, {
				namespace: "fixture.music",
				key: "secondary",
				kind: "vocabulary",
				valueKind: null,
			});
			const property = await ensureCatalogDefinition(tx, {
				namespace: "fixture.music",
				key: "property",
				kind: "property",
				valueKind: "string",
			});
			await assert.rejects(
				() => editMusicReleaseMetadata(tx, release, outsider.id, version, { barcode: "changed" }),
				CatalogAccessDenied,
			);
			await assert.rejects(
				() => editMusicReleaseMetadata(tx, release, actor, version - 1, { barcode: "stale" }),
				CatalogRevisionConflict,
			);
			await assert.rejects(
				() =>
					editMusicReleaseMetadata(tx, release, actor, version, {
						statusRevisionId: property.revisionId,
					}),
				/vocabulary/,
			);
			version = (
				await editMusicReleaseMetadata(tx, release, actor, version, {
					statusRevisionId: vocabulary.revisionId,
					packagingRevisionId: vocabulary.revisionId,
					languageTag: "EN-us",
					scriptCode: "Latn",
					barcode: "0012345678905",
				})
			).revision;
			const metadata = await readMusicReleaseMetadata(tx, release, actor);
			assert.equal(metadata.languageTag, "en-US");
			assert.equal(metadata.barcode, "0012345678905");
			assert.equal(metadata.packagingRevisionId, vocabulary.revisionId);
			await assert.rejects(() => readMusicReleaseMetadata(tx, release, null), CatalogAccessDenied);
			version = (await editMusicReleaseMetadata(tx, release, actor, version, { barcode: "" }))
				.revision;
			assert.equal((await readMusicReleaseMetadata(tx, release, actor)).barcode, "");

			const medium = await addMusicMedium(tx, release, actor, version, {
				position: 0,
				name: "Disc one",
			});
			version = medium.revision;
			version = (
				await editMusicMedium(tx, release, actor, version, medium.id, {
					formatRevisionId: vocabulary.revisionId,
				})
			).revision;
			const [storedMedium] = await tx
				.select()
				.from(musicMedium)
				.where(eq(musicMedium.id, medium.id));
			assert.equal(storedMedium?.formatRevisionId, vocabulary.revisionId);
			const firstToc = await attachMusicDiscToc(tx, release, actor, version, medium.id, {
				offsets: [150, 15000],
				leadoutOffset: 40000,
			});
			version = firstToc.revision;
			const secondToc = await attachMusicDiscToc(tx, release, actor, version, medium.id, {
				offsets: [151, 15001],
				leadoutOffset: 40001,
			});
			version = secondToc.revision;
			assert.deepEqual(
				(await readMusicDiscToc(tx, release, actor, medium.id, firstToc.id)).offsets,
				[150, 15000],
			);
			assert.equal(
				(await listMusicDiscTocs(tx, release, actor, medium.id, { limit: 1 }))[0]?.id,
				firstToc.id,
			);
			assert.equal(
				(await listMusicDiscTocs(tx, release, actor, medium.id, { afterId: firstToc.id }))[0]?.id,
				secondToc.id,
			);
			const otherRelease = await createMusicRelease(tx, actor, { name });
			await assert.rejects(
				() => readMusicDiscToc(tx, otherRelease, actor, medium.id, firstToc.id),
				CatalogReferenceNotFound,
			);
			await assert.rejects(
				() =>
					attachMusicDiscToc(tx, release, actor, version, crypto.randomUUID(), {
						offsets: [150],
						leadoutOffset: 200,
					}),
				CatalogReferenceNotFound,
			);

			const otherMedium = await addMusicMedium(tx, release, actor, version, { position: 1 });
			version = otherMedium.revision;
			assert.equal((await listMusicMedia(tx, release, actor, { limit: 1 }))[0]?.id, medium.id);
			assert.equal(
				(await listMusicMedia(tx, release, actor, { afterPosition: 0 }))[0]?.id,
				otherMedium.id,
			);
			const track = await addMusicTrack(tx, release, actor, version, {
				mediumId: medium.id,
				position: 0,
				number: "A1",
				name: "Original track",
			});
			version = track.revision;
			const wrongMediumTrack = await addMusicTrack(tx, release, actor, version, {
				mediumId: otherMedium.id,
				position: 0,
				number: "1",
			});
			version = wrongMediumTrack.revision;
			const credit = await createMusicCredit(tx, actor, [
				{ creditedName: "Presented artist", joinPhrase: "" },
			]);
			const outsiderCredit = await createMusicCredit(tx, outsider.id, [
				{ creditedName: "Private artist", joinPhrase: "" },
			]);
			await assert.rejects(
				() =>
					addMusicReleasePresentation(tx, release, actor, version, {
						artistCreditId: outsiderCredit,
					}),
				CatalogAccessDenied,
			);
			const presentation = await addMusicReleasePresentation(tx, release, actor, version, {
				name: "Alternate release title",
				languageTag: "ja",
				scriptCode: "Jpan",
				artistCreditId: credit,
			});
			version = presentation.revision;
			const mediumPresentation = await addMusicMediumPresentation(tx, release, actor, version, {
				releasePresentationId: presentation.id,
				mediumId: medium.id,
				name: "Alternate disc title",
			});
			version = mediumPresentation.revision;
			await assert.rejects(
				() =>
					addMusicTrackPresentation(tx, release, actor, version, {
						mediumPresentationId: mediumPresentation.id,
						trackId: wrongMediumTrack.id,
						name: "Wrong medium",
					}),
				CatalogReferenceNotFound,
			);
			version = (
				await addMusicTrackPresentation(tx, release, actor, version, {
					mediumPresentationId: mediumPresentation.id,
					trackId: track.id,
					name: "Alternate track title",
					artistCreditId: credit,
				})
			).revision;
			assert.equal(
				(await listMusicReleasePresentations(tx, release, actor))[0]?.name,
				"Alternate release title",
			);
			assert.equal(
				(await listMusicMediumPresentations(tx, release, actor, presentation.id))[0]?.name,
				"Alternate disc title",
			);
			assert.equal(
				(await listMusicTrackPresentations(tx, release, actor, mediumPresentation.id))[0]?.name,
				"Alternate track title",
			);

			const textAttribute = await ensureCatalogDefinition(tx, {
				namespace: "fixture.music",
				key: "carrier-color",
				kind: "property",
				valueKind: "string",
				constraints: { minLength: 1, maxLength: 5, allowedValues: ["black", "white"] },
			});
			const valueAttribute = await ensureCatalogDefinition(tx, {
				namespace: "fixture.music",
				key: "carrier-member",
				kind: "vocabulary",
				valueKind: null,
				constraints: { memberRevisionIds: [vocabulary.revisionId, otherVocabulary.revisionId] },
			});
			const textPolicy = {
				definitionRevisionId: textAttribute.revisionId,
				valueMode: "text" as const,
				formatRevisionIds: [vocabulary.revisionId, otherVocabulary.revisionId],
			};
			await installReviewedMusicMediumPolicy(tx, textPolicy);
			await installReviewedMusicMediumPolicy(tx, textPolicy);
			await assert.rejects(
				() =>
					installReviewedMusicMediumPolicy(tx, {
						...textPolicy,
						formatRevisionIds: [vocabulary.revisionId],
					}),
				/immutable meaning/,
			);
			await installReviewedMusicMediumPolicy(tx, {
				definitionRevisionId: valueAttribute.revisionId,
				valueMode: "vocabulary",
				formatRevisionIds: [vocabulary.revisionId, otherVocabulary.revisionId],
				valueFormats: [
					{ valueRevisionId: vocabulary.revisionId, formatRevisionId: vocabulary.revisionId },
					{
						valueRevisionId: otherVocabulary.revisionId,
						formatRevisionId: otherVocabulary.revisionId,
					},
				],
			});
			await assert.rejects(
				() =>
					addMusicMediumAttribute(tx, release, outsider.id, version, medium.id, {
						definitionRevisionId: textAttribute.revisionId,
						valueMode: "text",
						textValue: "black",
					}),
				CatalogAccessDenied,
			);
			await assert.rejects(
				() =>
					addMusicMediumAttribute(tx, release, actor, version, medium.id, {
						definitionRevisionId: textAttribute.revisionId,
						valueMode: "text",
						textValue: "blue",
					}),
				/governed vocabulary member/,
			);
			await assert.rejects(
				() =>
					addMusicMediumAttribute(tx, release, actor, version, medium.id, {
						definitionRevisionId: valueAttribute.revisionId,
						valueMode: "vocabulary",
						valueRevisionId: otherVocabulary.revisionId,
					}),
				/not allowed for the medium format/,
			);
			const textClaim = await addMusicMediumAttribute(tx, release, actor, version, medium.id, {
				definitionRevisionId: textAttribute.revisionId,
				valueMode: "text",
				textValue: "black",
			});
			version = textClaim.revision;
			const memberClaim = await addMusicMediumAttribute(tx, release, actor, version, medium.id, {
				definitionRevisionId: valueAttribute.revisionId,
				valueMode: "vocabulary",
				valueRevisionId: vocabulary.revisionId,
			});
			version = memberClaim.revision;
			await assert.rejects(
				() =>
					editMusicMedium(tx, release, actor, version, medium.id, {
						formatRevisionId: otherVocabulary.revisionId,
					}),
				/conflicts with existing attributes/,
			);
			await assert.rejects(
				() => editMusicMedium(tx, release, actor, version, medium.id, { formatRevisionId: null }),
				/conflicts with existing attributes/,
			);
			version = (
				await removeMusicMediumAttribute(tx, release, actor, version, medium.id, memberClaim.id)
			).revision;
			version = (
				await editMusicMedium(tx, release, actor, version, medium.id, {
					formatRevisionId: otherVocabulary.revisionId,
				})
			).revision;
			for (let index = 0; index < 104; index++) {
				version = (
					await addMusicMediumAttribute(tx, release, actor, version, medium.id, {
						definitionRevisionId: textAttribute.revisionId,
						valueMode: "text",
						textValue: "white",
					})
				).revision;
			}
			const attributePage = await listMusicMediumAttributes(tx, release, actor, medium.id, {
				limit: 100,
			});
			assert.equal(attributePage.length, 100);
			const lastAttribute = attributePage.at(-1);
			assert.ok(lastAttribute);
			assert.equal(
				(
					await listMusicMediumAttributes(tx, release, actor, medium.id, {
						afterId: lastAttribute.id,
					})
				).length,
				5,
			);
			version = (
				await editMusicMedium(tx, release, actor, version, medium.id, {
					formatRevisionId: vocabulary.revisionId,
				})
			).revision;

			const label = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "organization" },
				actor,
			);
			const privateOtherLabel = await createCatalogIdentity(
				tx,
				{ owner: "entity", shape: "organization" },
				outsider.id,
			);
			await assert.rejects(
				() =>
					addMusicReleaseLabel(tx, release, actor, version, {
						label: privateOtherLabel,
						catalogNumber: null,
					}),
				CatalogAccessDenied,
			);
			const association = await addMusicReleaseLabel(tx, release, actor, version, {
				label,
				catalogNumber: "NATIVE-001",
			});
			version = association.revision;
			const numberOnly = await addMusicReleaseLabel(tx, release, actor, version, {
				label: null,
				catalogNumber: "NATIVE-002",
			});
			version = numberOnly.revision;
			assert.equal(
				(await listMusicReleaseLabels(tx, release, actor, { limit: 1 }))[0]?.id,
				association.id,
			);
			assert.equal(
				(await listMusicReleaseLabels(tx, release, actor, { afterId: association.id }))[0]?.id,
				numberOnly.id,
			);
			version = (await removeMusicReleaseLabel(tx, release, actor, version, association.id))
				.revision;
			assert.equal((await listMusicReleaseLabels(tx, release, actor)).length, 1);

			const area = await createArea(tx, actor, { languageTag: "en", value: "Fixture area" });
			version = (
				await addReleaseDate(tx, release, actor, version, {
					date: { year: 2026, month: null, day: null },
					area,
				})
			).revision;
			const [event] = await listMusicReleaseEvents(tx, release, actor);
			assert.ok(event);
			assert.equal(event.dateMonth, null);
			version = (
				await editMusicReleaseEvent(tx, release, actor, version, event.id, {
					date: { year: null, month: 9, day: null },
					area: null,
				})
			).revision;
			assert.equal((await listMusicReleaseEvents(tx, release, actor))[0]?.dateYear, null);

			const work = await createMusicalWork(tx, actor, name);
			let workVersion = (
				await setMusicWorkType(tx, work, actor, work.revision, vocabulary.revisionId)
			).revision;
			workVersion = (await setMusicWorkLanguage(tx, work, actor, workVersion, "JA", true)).revision;
			workVersion = (await setMusicWorkLanguage(tx, work, actor, workVersion, "en", true)).revision;
			assert.equal(
				(await listMusicWorkLanguages(tx, work, actor, { limit: 1 }))[0]?.languageTag,
				"en",
			);
			assert.equal(
				(await listMusicWorkLanguages(tx, work, actor, { afterLanguageTag: "en" }))[0]?.languageTag,
				"ja",
			);
			await setMusicWorkLanguage(tx, work, actor, workVersion, "ja", false);
			assert.equal((await listMusicWorkLanguages(tx, work, actor)).length, 1);
			assert.equal(
				(await tx.select().from(musicWork).where(eq(musicWork.id, work.id)))[0]?.typeRevisionId,
				vocabulary.revisionId,
			);

			const group = await createReleaseGroup(tx, actor, name);
			let groupVersion = (
				await setMusicReleaseGroupPrimaryType(
					tx,
					group,
					actor,
					group.revision,
					vocabulary.revisionId,
				)
			).revision;
			groupVersion = (
				await setMusicReleaseGroupSecondaryType(
					tx,
					group,
					actor,
					groupVersion,
					vocabulary.revisionId,
					true,
				)
			).revision;
			groupVersion = (
				await setMusicReleaseGroupSecondaryType(
					tx,
					group,
					actor,
					groupVersion,
					otherVocabulary.revisionId,
					true,
				)
			).revision;
			assert.equal(
				(await listMusicReleaseGroupSecondaryTypes(tx, group, actor, { limit: 1 })).length,
				1,
			);
			assert.equal(
				(
					await listMusicReleaseGroupSecondaryTypes(tx, group, actor, {
						afterId: vocabulary.revisionId,
					})
				)[0]?.typeRevisionId,
				otherVocabulary.revisionId,
			);
			await setMusicReleaseGroupSecondaryType(
				tx,
				group,
				actor,
				groupVersion,
				vocabulary.revisionId,
				false,
			);
			assert.equal((await listMusicReleaseGroupSecondaryTypes(tx, group, actor)).length, 1);
			assert.equal(
				(await tx.select().from(musicReleaseGroup).where(eq(musicReleaseGroup.id, group.id)))[0]
					?.primaryTypeRevisionId,
				vocabulary.revisionId,
			);

			const [identity] = await tx
				.select()
				.from(musicIdentity)
				.where(eq(musicIdentity.id, release.id));
			assert.equal(identity?.revision, version);
			throw rollback;
		});
	} catch (error: unknown) {
		if (error !== rollback) throw error;
	}
	console.info(
		"Verified native music metadata, physical TOCs, label/date associations, work/group types and languages, access denial, revision conflicts and keyset pages; all fixture rows rolled back",
	);
} finally {
	await pool.end();
}
