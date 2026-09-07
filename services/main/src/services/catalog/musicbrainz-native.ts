import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import type { DatabaseTransaction } from "../database";
import { entityCatalogProfile } from "../database/schema/catalog-entity";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { referenceArea, referenceAreaCode } from "../database/schema/catalog-reference";
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
import {
	ensureCatalogDefinition,
	addCatalogName,
	beginCatalogFact,
	appendCatalogFactNodes,
	sealCatalogFact,
} from "./storage";
import { catalogValueNodes } from "./value-nodes";
import type { CatalogReference } from "./contracts";
import { bindReferencedSourceIdentity } from "./source-references";
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
) {
	const key = id || name;
	if (!key) return null;
	return (
		await ensureCatalogDefinition(tx, {
			namespace: `musicbrainz.${family}`,
			key,
			kind: "vocabulary",
			valueKind: null,
		})
	).revisionId;
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
			const shape =
				member.artist.type === "Person"
					? "person"
					: member.artist.type === "Character"
						? "character"
						: ["Group", "Orchestra", "Choir"].includes(member.artist.type ?? "")
							? "collective"
							: "unresolved";
			const artist = await bindReferencedSourceIdentity(tx, actor, {
				...musicBrainzSourceKey("artist", member.artist.id),
				owner: "entity",
				shape,
				name: member.artist.name,
				evidence: observation.referenceAt(`${path}/${position}/artist/id`),
			});
			if (artist.created) {
				await tx.insert(entityCatalogProfile).values({ id: artist.id, identityShape: shape });
				let revision = artist.revision;
				for (const alias of member.artist.aliases ?? [])
					revision = (
						await addCatalogName(tx, artist, actor, revision, {
							kind: "alias",
							languageTag: alias.locale || null,
							value: alias.name,
						})
					).revision;
			}
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

export async function projectMusicBrainzReleaseMetadata(
	tx: DatabaseTransaction,
	actor: string,
	observation: Observation,
	releaseId: string,
	record: MusicBrainzRelease,
) {
	for (const [position, event] of (record["release-events"] ?? []).entries()) {
		let areaId: string | null = null;
		if (event.area) {
			const area = await bindReferencedSourceIdentity(tx, actor, {
				...musicBrainzSourceKey("area", event.area.id),
				owner: "reference",
				shape: "area",
				name: event.area.name,
				evidence: observation.referenceAt(`/release-events/${position}/area/id`),
			});
			areaId = area.id;
			if (area.created) {
				await tx.insert(referenceArea).values({
					id: area.id,
					typeRevisionId: await musicBrainzVocabulary(
						tx,
						"area_type",
						event.area["type-id"],
						event.area.type,
					),
				});
				for (const [namespace, codes] of [
					["iso-3166-1", event.area["iso-3166-1-codes"]],
					["iso-3166-2", event.area["iso-3166-2-codes"]],
					["iso-3166-3", event.area["iso-3166-3-codes"]],
				] as const)
					for (const code of new Set(codes ?? []))
						await tx.insert(referenceAreaCode).values({ areaId, namespace, code });
			}
		}
		const date = musicBrainzDate(event.date);
		await tx.insert(musicReleaseEvent).values({
			releaseId,
			areaId,
			dateYear: date.year,
			dateMonth: date.month,
			dateDay: date.day,
			dateText: event.date ?? null,
		});
	}
	// The summary date is only a fallback when the source omitted its regional event list.
	if (!record["release-events"] && record.date) {
		const date = musicBrainzDate(record.date);
		await tx.insert(musicReleaseEvent).values({
			releaseId,
			dateYear: date.year,
			dateMonth: date.month,
			dateDay: date.day,
			dateText: record.date,
		});
	}
	for (const [position, entry] of (record["label-info"] ?? []).entries()) {
		let labelId: string | null = null;
		if (entry.label) {
			const label = await bindReferencedSourceIdentity(tx, actor, {
				...musicBrainzSourceKey("label", entry.label.id),
				owner: "entity",
				shape: "label",
				name: entry.label.name,
				evidence: observation.referenceAt(`/label-info/${position}/label/id`),
			});
			labelId = label.id;
			if (label.created)
				await tx.insert(entityCatalogProfile).values({
					id: labelId,
					identityShape: "label",
					typeRevisionId: await musicBrainzVocabulary(
						tx,
						"label_type",
						entry.label["type-id"],
						entry.label.type,
					),
				});
		}
		await tx
			.insert(musicReleaseLabel)
			.values({ releaseId, labelId, catalogNumber: entry["catalog-number"] ?? null });
	}
}

export async function projectMusicBrainzDiscs(
	tx: DatabaseTransaction,
	releaseId: string,
	mediumId: string,
	discs: NonNullable<MusicBrainzRelease["media"][number]["discs"]>,
) {
	for (const disc of discs) {
		const [toc] = await tx
			.insert(musicDiscToc)
			.values({ discId: disc.id, trackCount: disc["offset-count"], leadoutOffset: disc.sectors })
			.returning({ id: musicDiscToc.id });
		if (!toc) throw new Error("Disc TOC insertion returned no row");
		await tx
			.insert(musicDiscTocOffset)
			.values(disc.offsets.map((offset, position) => ({ tocId: toc.id, position, offset })));
		await tx.insert(musicMediumToc).values({ releaseId, mediumId, tocId: toc.id });
	}
}

export async function projectMusicBrainzGroupTypes(
	tx: DatabaseTransaction,
	releaseGroupId: string,
	record: MusicBrainzReleaseGroup,
) {
	const ids = record["secondary-type-ids"] ?? [];
	const names = record["secondary-types"] ?? [];
	for (let position = 0; position < Math.max(ids.length, names.length); position++) {
		const typeRevisionId = await musicBrainzVocabulary(
			tx,
			"release_group_secondary_type",
			ids[position],
			names[position],
		);
		if (typeRevisionId)
			await tx
				.insert(musicReleaseGroupSecondaryType)
				.values({ releaseGroupId, typeRevisionId })
				.onConflictDoNothing();
	}
}

export async function projectMusicBrainzWorkLanguages(
	tx: DatabaseTransaction,
	workId: string,
	record: MusicBrainzWork,
) {
	const languages = record.languages ?? (record.language ? [record.language] : []);
	for (const language of new Set(languages))
		await tx
			.insert(musicWorkLanguage)
			.values({ workId, languageTag: canonicalizeContentLanguageTag(language) })
			.onConflictDoNothing();
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

/** Composer-catalogue numbers and other governed work attributes remain queryable scalar facts. */
export async function projectMusicBrainzWorkAttributes(
	tx: DatabaseTransaction,
	actor: string,
	reference: CatalogReference,
	expectedRevision: number,
	observation: Observation,
	record: MusicBrainzWork,
) {
	let revision = expectedRevision;
	for (const [position, attribute] of (record.attributes ?? []).entries()) {
		const definition = await ensureCatalogDefinition(tx, {
			namespace: "musicbrainz.work_attribute",
			key: attribute["type-id"] ?? attribute.type,
			kind: "property",
			valueKind: "string",
		});
		const fact = await beginCatalogFact(tx, reference, actor, revision, definition.revisionId);
		const appended = await appendCatalogFactNodes(
			tx,
			reference,
			actor,
			fact.revision,
			fact.id,
			-1,
			[...catalogValueNodes(attribute.value)],
		);
		revision = (
			await sealCatalogFact(
				tx,
				reference,
				actor,
				appended.revision,
				fact.id,
				appended.lastNodePosition,
			)
		).revision;
		await tx.insert(CatalogFactTables.music.support).values({
			ownerId: reference.id,
			factId: fact.id,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			sourcePath: `/attributes/${position}`,
		});
	}
	return revision;
}
