import { musicBrainzLanguageTag } from "./musicbrainz-language";
import type { DatabaseTransaction } from "../database";
import { initializeEntityProfile, resolveEntityShape } from "./entities";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { initializeReferenceProfile, appendAreaCodes } from "./references";
import { adoptMusicBrainzAliases } from "./musicbrainz-names";
import { musicBrainzArtistShape, musicBrainzLabelShape } from "./musicbrainz-entities";
import { addCatalogIdentifier } from "./identifiers";
import {
	musicDiscToc,
	musicDiscTocOffset,
	musicMediumToc,
	musicReleaseEvent,
	musicReleaseLabel,
	musicReleaseGroupSecondaryType,
	musicWorkLanguage,
} from "../database/schema/catalog-music";
import { beginMusicCredit, appendMusicCreditMembers, sealMusicCredit } from "./domains";
import { ensureCatalogDefinition, addCatalogName } from "./storage";
import { bindCatalogNameSourceOccurrence } from "./names";
import { attachCatalogDefinitionTerm } from "./definition-terms";
import { bindReferencedSourceIdentity } from "./source-references";
import { recordMusicSourceComponent } from "./music-source-occurrences";
import type { recordCatalogSourceDocument } from "./source-observations";
import {
	musicBrainzDate,
	musicBrainzSourceKey,
	type MusicBrainzCredit,
	type MusicBrainzRelease,
	type MusicBrainzReleaseGroup,
	type MusicBrainzWork,
} from "./musicbrainz";

type Observation = Awaited<ReturnType<typeof recordCatalogSourceDocument>>;

/** Source taxonomy members are reviewed external vocabularies, never owner identities. */
export async function musicBrainzVocabulary(
	tx: DatabaseTransaction,
	family: string,
	id: string | null | undefined,
	name: string | null | undefined,
	source?: { actor: string; observation: Observation; idPath: string; namePath: string },
) {
	const key = id || name;
	if (!key) return null;
	const releaseSlots: Record<string, string> = {
		release_status: "music_release.status_revision_id",
		release_packaging: "music_release.packaging_revision_id",
		medium_format: "music_medium.format_revision_id",
		alternative_release_type: "music_release_presentation.type_revision_id",
		work_type: "music_work.type_revision_id",
		release_group_primary_type: "music_release_group.primary_type_revision_id",
		release_group_secondary_type: "music_release_group_secondary_type.type_revision_id",
	};
	const slot = releaseSlots[family];
	const definition = await ensureCatalogDefinition(tx, {
		namespace: `musicbrainz.${family}`,
		key,
		kind: "vocabulary",
		valueKind: null,
		...(slot
			? {
					constraints: {
						targets: [
							{
								owner: "music" as const,
								shapes: [
									family === "work_type"
										? "work"
										: family.startsWith("release_group_")
											? "release_group"
											: "release",
								],
							},
						],
						slots: [slot],
					},
				}
			: {}),
	});
	if (source) {
		const evidence = source.observation.referenceAt(id ? source.idPath : source.namePath);
		if (name && source.observation.referenceAt(source.namePath).externalId !== name)
			throw new TypeError("Taxonomy label differs from its recorded source evidence");
		const concept = await bindReferencedSourceIdentity(tx, source.actor, {
			source: "musicbrainz",
			objectType: family,
			externalId: key,
			owner: "reference",
			shape: "concept",
			evidence,
			initialize: async (created) => {
				let revision = (
					await initializeReferenceProfile(tx, created, source.actor, created.revision, {
						shape: "concept",
						typeRevisionId: null,
					})
				).revision;
				if (name) {
					const named = await addCatalogName(tx, created, source.actor, revision, {
						kind: "source-reference",
						languageTag: "en",
						value: name,
					});
					revision = named.revision;
					await bindCatalogNameSourceOccurrence(tx, created, source.actor, {
						sourceRecordId: source.observation.record.id,
						snapshotId: source.observation.snapshot.id,
						namespace: "musicbrainz.taxonomy.name",
						localKey: "primary",
						nameId: named.id,
						nameRevision: named.nameRevision,
						sourcePath: source.namePath,
					});
					await tx
						.insert(CatalogFactTables.reference.support)
						.values({
							ownerId: created.id,
							namedFormId: named.id,
							sourceRecordId: source.observation.record.id,
							snapshotId: source.observation.snapshot.id,
							sourcePath: source.namePath,
						});
				}
				return { ...created, revision };
			},
		});
		await attachCatalogDefinitionTerm(tx, source.actor, {
			definitionRevisionId: definition.revisionId,
			conceptId: concept.id,
			evidence,
		});
	}
	return definition.revisionId;
}

/** Cache lifetime is one admitted document; it never grows with the source corpus. */
export function musicBrainzCreditWriter(
	tx: DatabaseTransaction,
	actor: string,
	observation: Observation,
) {
	const cache = new Map<string, string>();
	return async (members: MusicBrainzCredit | undefined, path: string) => {
		if (!members?.length) return null;
		const signature = JSON.stringify(
			members.map((member) => [member.artist.id, member.name, member.joinphrase ?? ""]),
		);
		const cached = cache.get(signature);
		if (cached) return cached;
		const values = [];
		for (const [position, member] of members.entries()) {
			const shape = musicBrainzArtistShape(member.artist.type);
			const artist = await bindReferencedSourceIdentity(tx, actor, {
				...musicBrainzSourceKey("artist", member.artist.id),
				owner: "entity",
				shape: "unresolved",
				name: member.artist.name,
				evidence: observation.referenceAt(`${path}/${position}/artist/id`),
				initialize: async (created) => {
					let revision = created.revision;
					if (shape !== "unresolved")
						revision = (await resolveEntityShape(tx, created, actor, revision, shape)).revision;
					revision = (
						await initializeEntityProfile(tx, created, actor, revision, {
							typeRevisionId: await musicBrainzVocabulary(
								tx,
								"artist_type",
								member.artist["type-id"],
								member.artist.type,
								{
									actor,
									observation,
									idPath: `${path}/${position}/artist/type-id`,
									namePath: `${path}/${position}/artist/type`,
								},
							),
						})
					).revision;
					revision = await adoptMusicBrainzAliases(
						tx,
						actor,
						created,
						revision,
						observation,
						member.artist.aliases ?? [],
						`${path}/${position}/artist/aliases`,
					);
					return { ...created, revision };
				},
			});
			values.push({
				artist,
				creditedName: member.name,
				joinPhrase: member.joinphrase ?? "",
				sourcePosition: position,
			});
		}
		const id = await beginMusicCredit(
			tx,
			actor,
			values.map((value) => value.creditedName + value.joinPhrase).join(""),
		);
		for (let offset = 0; offset < values.length; offset += 128)
			await appendMusicCreditMembers(tx, actor, id, offset, values.slice(offset, offset + 128));
		await sealMusicCredit(tx, actor, id, values.length);
		cache.set(signature, id);
		return id;
	};
}

/** @internal Initializes referenced area metadata/codes before its own source baseline is sealed. */
export async function musicBrainzAreaReference(
	tx: DatabaseTransaction,
	actor: string,
	observation: Observation,
	area: NonNullable<NonNullable<MusicBrainzRelease["release-events"]>[number]["area"]>,
	path: string,
) {
	return bindReferencedSourceIdentity(tx, actor, {
		...musicBrainzSourceKey("area", area.id),
		owner: "reference",
		shape: "area",
		name: area.name,
		evidence: observation.referenceAt(`${path}/id`),
		initialize: async (created) => {
			let revision = (
				await initializeReferenceProfile(tx, created, actor, created.revision, {
					shape: "area",
					typeRevisionId: await musicBrainzVocabulary(tx, "area_type", area["type-id"], area.type, {
						actor,
						observation,
						idPath: `${path}/type-id`,
						namePath: `${path}/type`,
					}),
				})
			).revision;
			for (const [namespace, codes] of [
				["iso-3166-1", area["iso-3166-1-codes"]],
				["iso-3166-2", area["iso-3166-2-codes"]],
				["iso-3166-3", area["iso-3166-3-codes"]],
			] as const) {
				const values = [...new Set(codes ?? [])].map((code) => ({ namespace, code }));
				for (let offset = 0; offset < values.length; offset += 128)
					revision = (
						await appendAreaCodes(tx, created, actor, revision, values.slice(offset, offset + 128))
					).revision;
			}
			return { ...created, revision };
		},
	});
}

/** @internal Label references use the shared catalog Entity profile and exact identifier owner. */
export async function musicBrainzLabelReference(
	tx: DatabaseTransaction,
	actor: string,
	observation: Observation,
	label: NonNullable<NonNullable<MusicBrainzRelease["label-info"]>[number]["label"]>,
	path: string,
) {
	return bindReferencedSourceIdentity(tx, actor, {
		...musicBrainzSourceKey("label", label.id),
		owner: "entity",
		shape: "unresolved",
		name: label.name,
		evidence: observation.referenceAt(`${path}/id`),
		initialize: async (created) => {
			let revision = (
				await resolveEntityShape(
					tx,
					created,
					actor,
					created.revision,
					musicBrainzLabelShape(label.type),
				)
			).revision;
			revision = (
				await initializeEntityProfile(tx, created, actor, revision, {
					typeRevisionId: await musicBrainzVocabulary(
						tx,
						"label_type",
						label["type-id"],
						label.type,
						{ actor, observation, idPath: `${path}/type-id`, namePath: `${path}/type` },
					),
				})
			).revision;
			if (label["label-code"] != null) {
				const identifier = await addCatalogIdentifier(tx, created, actor, revision, {
					namespace: "label-code",
					value: String(label["label-code"]),
				});
				revision = identifier.revision;
				await tx.insert(CatalogFactTables.entity.support).values({
					ownerId: created.id,
					identifierId: identifier.id,
					sourceRecordId: observation.record.id,
					snapshotId: observation.snapshot.id,
					sourcePath: `${path}/label-code`,
				});
			}
			return { ...created, revision };
		},
	});
}

export async function projectMusicBrainzReleaseMetadata(
	tx: DatabaseTransaction,
	actor: string,
	observation: Observation,
	releaseId: string,
	record: MusicBrainzRelease,
) {
	for (const [position, event] of (record["release-events"] ?? []).entries()) {
		let areaId: string | null = null;
		if (event.area)
			areaId = (
				await musicBrainzAreaReference(
					tx,
					actor,
					observation,
					event.area,
					`/release-events/${position}/area`,
				)
			).id;

		const date = musicBrainzDate(event.date);
		const [nativeEvent] = await tx
			.insert(musicReleaseEvent)
			.values({
				releaseId,
				areaId,
				dateYear: date.year,
				dateMonth: date.month,
				dateDay: date.day,
				dateText: event.date ?? null,
			})
			.returning({ id: musicReleaseEvent.id });
		if (!nativeEvent) throw new Error("Release event insertion returned no row");
		await recordMusicSourceComponent(
			tx,
			observation,
			releaseId,
			"music_release_event",
			nativeEvent.id,
			`/release-events/${position}`,
		);
	}
	// The summary date is only a fallback when the source omitted its regional event list.
	if (!record["release-events"] && record.date) {
		const date = musicBrainzDate(record.date);
		const [nativeEvent] = await tx
			.insert(musicReleaseEvent)
			.values({
				releaseId,
				dateYear: date.year,
				dateMonth: date.month,
				dateDay: date.day,
				dateText: record.date,
			})
			.returning({ id: musicReleaseEvent.id });
		if (!nativeEvent) throw new Error("Release event insertion returned no row");
		await recordMusicSourceComponent(
			tx,
			observation,
			releaseId,
			"music_release_event",
			nativeEvent.id,
			"/date",
		);
	}
	for (const [position, entry] of (record["label-info"] ?? []).entries()) {
		let labelId: string | null = null;
		if (entry.label)
			labelId = (
				await musicBrainzLabelReference(
					tx,
					actor,
					observation,
					entry.label,
					`/label-info/${position}/label`,
				)
			).id;

		const [nativeLabel] = await tx
			.insert(musicReleaseLabel)
			.values({ releaseId, labelId, catalogNumber: entry["catalog-number"] ?? null })
			.returning({ id: musicReleaseLabel.id });
		if (!nativeLabel) throw new Error("Release label insertion returned no row");
		await recordMusicSourceComponent(
			tx,
			observation,
			releaseId,
			"music_release_label",
			nativeLabel.id,
			`/label-info/${position}`,
		);
	}
}

export async function projectMusicBrainzDiscs(
	tx: DatabaseTransaction,
	releaseId: string,
	mediumId: string,
	discs: NonNullable<MusicBrainzRelease["media"][number]["discs"]>,
	source?: { observation: Observation; path: string },
) {
	for (const [position, disc] of discs.entries()) {
		const [toc] = await tx
			.insert(musicDiscToc)
			.values({ discId: disc.id, trackCount: disc["offset-count"], leadoutOffset: disc.sectors })
			.returning({ id: musicDiscToc.id });
		if (!toc) throw new Error("Disc TOC insertion returned no row");
		await tx
			.insert(musicDiscTocOffset)
			.values(disc.offsets.map((offset, position) => ({ tocId: toc.id, position, offset })));
		await tx.insert(musicMediumToc).values({ releaseId, mediumId, tocId: toc.id });
		if (source)
			await recordMusicSourceComponent(
				tx,
				source.observation,
				releaseId,
				"music_medium_toc",
				`${mediumId}/${toc.id}`,
				`${source.path}/${position}`,
			);
	}
}

export async function projectMusicBrainzGroupTypes(
	tx: DatabaseTransaction,
	releaseGroupId: string,
	record: MusicBrainzReleaseGroup,
	observation?: Observation,
	termSource?: { actor: string; observation: Observation; path: string },
) {
	const ids = record["secondary-type-ids"] ?? [];
	const names = record["secondary-types"] ?? [];
	const recorded = new Set<string>();
	for (let position = 0; position < Math.max(ids.length, names.length); position++) {
		const typeRevisionId = await musicBrainzVocabulary(
			tx,
			"release_group_secondary_type",
			ids[position],
			names[position],
			termSource
				? {
						actor: termSource.actor,
						observation: termSource.observation,
						idPath: `${termSource.path}/secondary-type-ids/${position}`,
						namePath: `${termSource.path}/secondary-types/${position}`,
					}
				: undefined,
		);
		if (typeRevisionId && !recorded.has(typeRevisionId)) {
			await tx
				.insert(musicReleaseGroupSecondaryType)
				.values({ releaseGroupId, typeRevisionId })
				.onConflictDoNothing();
			recorded.add(typeRevisionId);
			if (observation)
				await recordMusicSourceComponent(
					tx,
					observation,
					releaseGroupId,
					"music_release_group_secondary_type",
					typeRevisionId,
					`/secondary-types/${position}`,
				);
		}
	}
}

export async function projectMusicBrainzWorkLanguages(
	tx: DatabaseTransaction,
	workId: string,
	record: MusicBrainzWork,
	observation?: Observation,
) {
	const languages = record.languages ?? (record.language ? [record.language] : []);
	const recorded = new Set<string>();
	for (const [position, language] of languages.entries()) {
		const languageTag = musicBrainzLanguageTag(language);
		if (recorded.has(languageTag)) continue;
		await tx.insert(musicWorkLanguage).values({ workId, languageTag }).onConflictDoNothing();
		recorded.add(languageTag);
		if (observation)
			await recordMusicSourceComponent(
				tx,
				observation,
				workId,
				"music_work_language",
				languageTag,
				record.languages ? `/languages/${position}` : "/language",
			);
	}
}

/** Identifiers are many-valued: ISRC and ISWC are not assumed globally unique. */
export async function projectMusicBrainzIdentifiers(
	tx: DatabaseTransaction,
	ownerId: string,
	namespace: "isrc" | "iswc" | "asin",
	values: readonly string[],
) {
	for (const value of new Set(values))
		await tx.insert(CatalogFactTables.music.identifier).values({
			ownerId,
			namespace,
			value,
			normalizedValue: value.replaceAll("-", "").replaceAll(".", "").toUpperCase(),
		});
}
