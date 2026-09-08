import { isDeepStrictEqual } from "node:util";
import { runParticipationSavepoint } from "../participation/policy";
import { musicBrainzLanguageTag } from "./musicbrainz-language";
import { MusicBrainzCatalogContractSha256, MusicBrainzObjectDocumentSchema } from "./musicbrainz";
import { loadCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import { musicBrainzCreditWriter, musicBrainzVocabulary } from "./musicbrainz-native";
import { applyMusicBrainzNameDelta } from "./musicbrainz-name-delta";
import { applyMusicBrainzFactDelta, musicBrainzFactDescriptors } from "./musicbrainz-facts";
import { compensateMusicSourceApplication } from "./music-source-compensation";
import { prepareMusicSourceProjection } from "./music-source-projection";
import { applyMusicBrainzIdentifierDelta } from "./musicbrainz-identifier-delta";

type Archived = { receipt: CatalogSourceReceipt; bytes: Uint8Array };

/** @internal Own work/recording/release-group snapshots apply real native changes through the shared exact component protocol. */
export function musicBrainzObjectNativeWriter(
	previousArchive: Archived,
	incomingArchive: Archived,
): CatalogSourceNativeWriter {
	return async (outer, context) =>
		runParticipationSavepoint(outer, async (tx) => {
			if (context.action === "withdraw") return compensateMusicSourceApplication(tx, context);
			if (context.reference.owner !== "music" || !context.previousSnapshotId)
				throw new TypeError("Music object update requires its previous adopted source snapshot");
			for (const archive of [previousArchive, incomingArchive])
				if (
					archive.receipt.key.source !== "musicbrainz" ||
					archive.receipt.contractSha256 !== MusicBrainzCatalogContractSha256
				)
					throw new TypeError("Unreviewed MusicBrainz object archive");
			await loadCatalogSourceDocument(
				tx,
				context.sourceRecordId,
				context.previousSnapshotId,
				previousArchive.receipt,
				previousArchive.bytes,
			);
			const observation = await loadCatalogSourceDocument(
				tx,
				context.sourceRecordId,
				context.snapshotId,
				incomingArchive.receipt,
				incomingArchive.bytes,
			);
			const previous = MusicBrainzObjectDocumentSchema.parse({
				kind: previousArchive.receipt.key.objectType,
				record: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(previousArchive.bytes)),
			});
			const incoming = MusicBrainzObjectDocumentSchema.parse({
				kind: incomingArchive.receipt.key.objectType,
				record: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(incomingArchive.bytes)),
			});
			if (
				previous.kind !== incoming.kind ||
				previous.record.id !== incoming.record.id ||
				incoming.record.id !== incomingArchive.receipt.key.externalId ||
				context.mappingVersion !== `musicbrainz.${incoming.kind}.2`
			)
				throw new TypeError("Music object source identity or mapper changed");
			if (!isDeepStrictEqual(previous.record.relations, incoming.record.relations))
				throw new TypeError("Music object relationship delta requires its native semantic writer");
			const factInput = (document: typeof incoming) =>
				document.kind === "work"
					? document.record
					: {
							annotation: document.record.annotation,
							disambiguation: document.record.disambiguation,
							"first-release-date":
								document.kind === "release_group"
									? document.record["first-release-date"]
									: undefined,
						};
			if (
				2 +
					(previous.record.aliases?.length ?? 0) +
					(incoming.record.aliases?.length ?? 0) +
					musicBrainzFactDescriptors(factInput(previous)).length +
					musicBrainzFactDescriptors(factInput(incoming)).length >
				128
			)
				throw new RangeError("Music object requires staged source application");
			const source = await prepareMusicSourceProjection(tx, {
				...context,
				previousSnapshotId: context.previousSnapshotId,
			});
			const ownerId = context.reference.id;
			const credit = musicBrainzCreditWriter(
				tx,
				context.actor,
				observation,
				context.reference,
				"prepared",
			);
			if (incoming.kind === "work" && previous.kind === "work") {
				const old = source.oldAt("music_work", "/");
				source.put(
					"music_work",
					"/",
					{
						...old.value,
						type_revision_id: await musicBrainzVocabulary(
							tx,
							"work_type",
							incoming.record["type-id"],
							incoming.record.type,
							{
								actor: context.actor,
								observation,
								idPath: "/type-id",
								namePath: "/type",
								mode: "prepared",
							},
						),
					},
					old,
				);
				const languages =
					incoming.record.languages ?? (incoming.record.language ? [incoming.record.language] : []);
				if (languages.length > 128)
					throw new RangeError("Work languages require staged application");
				const seen = new Set<string>();
				for (const [index, language] of languages.entries()) {
					const tag = musicBrainzLanguageTag(language);
					if (seen.has(tag)) continue;
					seen.add(tag);
					const path = incoming.record.languages ? `/languages/${index}` : "/language";
					source.put(
						"music_work_language",
						path,
						{ work_id: ownerId, language_tag: tag },
						source.oldByKey("music_work_language", tag) ??
							source.recoverAt("music_work_language", path),
					);
				}
			} else if (incoming.kind === "recording" && previous.kind === "recording") {
				const old = source.oldAt("music_recording", "/");
				source.put(
					"music_recording",
					"/",
					{
						...old.value,
						length_milliseconds: incoming.record.length ?? null,
						video: incoming.record.video ?? null,
						artist_credit_id: isDeepStrictEqual(
							previous.record["artist-credit"],
							incoming.record["artist-credit"],
						)
							? old.value.artist_credit_id
							: await credit(incoming.record["artist-credit"], "/artist-credit"),
					},
					old,
				);
			} else if (incoming.kind === "release_group" && previous.kind === "release_group") {
				const old = source.oldAt("music_release_group", "/");
				source.put(
					"music_release_group",
					"/",
					{
						...old.value,
						primary_type_revision_id: await musicBrainzVocabulary(
							tx,
							"release_group_primary_type",
							incoming.record["primary-type-id"],
							incoming.record["primary-type"],
							{
								actor: context.actor,
								mode: "prepared",
								observation,
								idPath: "/primary-type-id",
								namePath: "/primary-type",
							},
						),
						artist_credit_id: isDeepStrictEqual(
							previous.record["artist-credit"],
							incoming.record["artist-credit"],
						)
							? old.value.artist_credit_id
							: await credit(incoming.record["artist-credit"], "/artist-credit"),
					},
					old,
				);
				const ids = incoming.record["secondary-type-ids"] ?? [];
				const names = incoming.record["secondary-types"] ?? [];
				if (Math.max(ids.length, names.length) > 128)
					throw new RangeError("Release-group types require staged application");
				const seen = new Set<string>();
				for (let index = 0; index < Math.max(ids.length, names.length); index++) {
					const typeId = await musicBrainzVocabulary(
						tx,
						"release_group_secondary_type",
						ids[index],
						names[index],
						{
							actor: context.actor,
							mode: "prepared",
							observation,
							idPath: `/secondary-type-ids/${index}`,
							namePath: `/secondary-types/${index}`,
						},
					);
					if (!typeId || seen.has(typeId)) continue;
					seen.add(typeId);
					const path = `/secondary-types/${index}`;
					source.put(
						"music_release_group_secondary_type",
						path,
						{ release_group_id: ownerId, type_revision_id: typeId },
						source.oldByKey("music_release_group_secondary_type", typeId) ??
							source.recoverAt("music_release_group_secondary_type", path),
					);
				}
			}
			const structural = await source.finish();
			const names = await applyMusicBrainzNameDelta(
				tx,
				context.reference,
				context.actor,
				structural.revision,
				context.sourceRecordId,
				context.mappingKey,
				context.previousSnapshotId,
				context.snapshotId,
				previous.record,
				incoming.record,
			);
			const facts = await applyMusicBrainzFactDelta(
				tx,
				context.reference,
				context.actor,
				names.revision,
				observation,
				{
					snapshotId: context.previousSnapshotId,
					mappingKey: context.mappingKey,
					record: factInput(previous),
				},
				factInput(incoming),
			);
			const identifierEntries = (document: typeof incoming) =>
				document.kind === "work"
					? (document.record.iswcs ?? []).map((value, index) => ({
							namespace: "iswc",
							value,
							path: `/iswcs/${index}`,
						}))
					: document.kind === "recording"
						? (document.record.isrcs ?? []).map((value, index) => ({
								namespace: "isrc",
								value,
								path: `/isrcs/${index}`,
							}))
						: [];
			const identifiers = await applyMusicBrainzIdentifierDelta(
				tx,
				context.reference,
				context.actor,
				facts.revision,
				{ ...context, previousSnapshotId: context.previousSnapshotId },
				identifierEntries(previous),
				identifierEntries(incoming),
			);
			return {
				revision: identifiers.revision,
				changes: [
					...structural.changes.map((change) => ({
						kind: "music-component" as const,
						ownerId,
						...change,
					})),
					...names.changes,
					...facts.changes,
					...identifiers.changes,
				],
			};
		});
}
