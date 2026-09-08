import { isDeepStrictEqual } from "node:util";
import { applyMusicBrainzRelationDelta } from "./musicbrainz-relation-delta";
import { applyCatalogSourceIdentifierDelta } from "./source-identifier-delta";
import { runParticipationSavepoint } from "../participation/policy";
import { musicBrainzLanguageTag } from "./musicbrainz-language";
import { z } from "zod";
import { musicDiscToc, musicDiscTocOffset } from "../database/schema/catalog-music";
import {
	MusicBrainzCatalogContractSha256,
	MusicBrainzReleaseSchema,
	musicBrainzDate,
	musicBrainzSourceKey,
} from "./musicbrainz";
import {
	musicBrainzCreditWriter,
	musicBrainzVocabulary,
	musicBrainzAreaReference,
	musicBrainzLabelReference,
} from "./musicbrainz-native";
import { bindReferencedSourceIdentity } from "./source-references";
import { loadCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import { applyMusicBrainzNameDelta } from "./musicbrainz-name-delta";
import { applyMusicBrainzFactDelta } from "./musicbrainz-facts";
import { compensateMusicSourceApplication } from "./music-source-compensation";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import {
	prepareMusicSourceProjection,
	type MusicSourceComponentBaseline as Baseline,
} from "./music-source-projection";

import {
	tracks,
	correlateMusicBrainzMedia,
	preflightMusicBrainzReleaseDelta,
} from "./musicbrainz-release-plan";

type Archived = { receipt: CatalogSourceReceipt; bytes: Uint8Array };
/**
 * @internal Genuine structural proposal callback over two exact archived snapshots.
 * @remarks It never invokes first adoption. Unchanged rows retain their previous source baseline;
 * changed/removal operations compare-and-swap that exact child, preserving intervening corrections.
 */
export function musicBrainzReleaseNativeWriter(
	previousArchive: Archived,
	incomingArchive: Archived,
): CatalogSourceNativeWriter {
	return async (outer, context) =>
		runParticipationSavepoint(outer, async (tx) => {
			if (context.reference.owner !== "music" || context.mappingVersion !== "musicbrainz.release.1")
				throw new TypeError("Music release writer received another mapping");
			if (context.action === "withdraw") return compensateMusicSourceApplication(tx, context);
			if (!context.previousSnapshotId)
				throw new TypeError("An update requires a previous adopted snapshot");
			for (const archive of [previousArchive, incomingArchive])
				if (
					archive.receipt.key.source !== "musicbrainz" ||
					archive.receipt.key.objectType !== "release" ||
					archive.receipt.contractSha256 !== MusicBrainzCatalogContractSha256
				)
					throw new TypeError("Unreviewed MusicBrainz release archive");
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
			const previous = MusicBrainzReleaseSchema.parse(
				JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(previousArchive.bytes)),
			);
			const incoming = MusicBrainzReleaseSchema.parse(
				JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(incomingArchive.bytes)),
			);
			if (
				incoming.id !== incomingArchive.receipt.key.externalId ||
				previous.id !== previousArchive.receipt.key.externalId
			)
				throw new TypeError("Release document differs from its archived source key");
			preflightMusicBrainzReleaseDelta(previous, incoming);
			const { oldAt, recoverAt, put, finish } = await prepareMusicSourceProjection(tx, {
				...context,
				previousSnapshotId: context.previousSnapshotId,
			});
			const credit = musicBrainzCreditWriter(
				tx,
				context.actor,
				observation,
				context.reference,
				"prepared",
			);
			const releaseId = context.reference.id;
			const root = oldAt("music_release", "/");
			const recoveredRelease = recoverAt("music_release", "/");
			let releaseGroupId = root.value.release_group_id;
			if (incoming["release-group"]?.id !== previous["release-group"]?.id) {
				const group = incoming["release-group"];
				if (!group) releaseGroupId = null;
				else {
					const target = await bindReferencedSourceIdentity(tx, context.actor, {
						mode: "prepared",
						...musicBrainzSourceKey("release_group", group.id),
						owner: "music",
						shape: "release_group",
						name: group.title,
						evidence: observation.referenceAt("/release-group/id"),
					});
					releaseGroupId = target.id;
				}
			}
			put(
				"music_release",
				"/",
				{
					...root.value,
					release_group_id: releaseGroupId,
					artist_credit_id: isDeepStrictEqual(previous["artist-credit"], incoming["artist-credit"])
						? root.value.artist_credit_id
						: recoveredRelease
							? recoveredRelease.value.artist_credit_id
							: await credit(incoming["artist-credit"], "/artist-credit"),
					status_revision_id: await musicBrainzVocabulary(
						tx,
						"release_status",
						incoming["status-id"],
						incoming.status,
						{
							actor: context.actor,
							observation,
							idPath: "/status-id",
							namePath: "/status",
							mode: "prepared",
						},
					),
					packaging_revision_id: await musicBrainzVocabulary(
						tx,
						"release_packaging",
						incoming["packaging-id"],
						incoming.packaging,
						{
							actor: context.actor,
							observation,
							idPath: "/packaging-id",
							namePath: "/packaging",
							mode: "prepared",
						},
					),
					language_tag: incoming["text-representation"]?.language
						? musicBrainzLanguageTag(incoming["text-representation"].language)
						: null,
					script_code: incoming["text-representation"]?.script || null,
					barcode: incoming.barcode ?? null,
				},
				root,
			);
			const oldTracks = new Map(
				previous.media.flatMap((medium, index) =>
					tracks(medium, index).map((entry) => [entry.track.id, entry] as const),
				),
			);
			const correspondence = correlateMusicBrainzMedia(previous, incoming);
			for (const [index, medium] of incoming.media.entries()) {
				const oldIndex = correspondence[index];
				const oldMedium = oldIndex == null ? undefined : previous.media[oldIndex];
				const old =
					oldIndex == null
						? recoverAt("music_medium", `/media/${index}`)
						: oldAt("music_medium", `/media/${oldIndex}`);
				const mediumId = old?.componentKey ?? crypto.randomUUID();
				put(
					"music_medium",
					`/media/${index}`,
					{
						release_id: releaseId,
						id: mediumId,
						position: medium.position,
						name: medium.title ?? null,
						format_revision_id: await musicBrainzVocabulary(
							tx,
							"medium_format",
							medium["format-id"],
							medium.format,
							{
								actor: context.actor,
								mode: "prepared",
								observation,
								idPath: `/media/${index}/format-id`,
								namePath: `/media/${index}/format`,
							},
						),
						source_track_count: medium["track-count"] ?? null,
					},
					old,
				);
				if (medium.id)
					put(
						"music_medium_identifier",
						`/media/${index}/id`,
						{
							release_id: releaseId,
							medium_id: mediumId,
							namespace: "musicbrainz.medium",
							value: medium.id,
						},
						oldMedium?.id === medium.id
							? oldAt("music_medium_identifier", `/media/${oldIndex}/id`)
							: recoverAt("music_medium_identifier", `/media/${index}/id`),
					);
				for (const entry of tracks(medium, index)) {
					const previousTrack = oldTracks.get(entry.track.id);
					const oldTrack = previousTrack
						? oldAt("music_track_occurrence", previousTrack.path)
						: recoverAt("music_track_occurrence", entry.path);
					const trackId = oldTrack?.componentKey ?? crypto.randomUUID();
					const recoveredTrack = recoverAt("music_track_occurrence", entry.path);
					let recordingId = oldTrack?.value.recording_id;
					if (!previousTrack || previousTrack.track.recording.id !== entry.track.recording.id) {
						const target = await bindReferencedSourceIdentity(tx, context.actor, {
							mode: "prepared",
							...musicBrainzSourceKey("recording", entry.track.recording.id),
							owner: "music",
							shape: "recording",
							name: entry.track.recording.title,
							evidence: observation.referenceAt(`${entry.path}/recording/id`),
						});
						recordingId = target.id;
					}
					put(
						"music_track_occurrence",
						entry.path,
						{
							release_id: releaseId,
							medium_id: mediumId,
							id: trackId,
							position: entry.track.position,
							number: entry.track.number,
							name: entry.track.title,
							recording_id: recordingId,
							artist_credit_id:
								previousTrack &&
								isDeepStrictEqual(
									previousTrack.track["artist-credit"],
									entry.track["artist-credit"],
								)
									? oldTrack?.value.artist_credit_id
									: recoveredTrack
										? recoveredTrack.value.artist_credit_id
										: await credit(entry.track["artist-credit"], `${entry.path}/artist-credit`),
							length_milliseconds: entry.track.length ?? null,
							is_data_track: entry.data,
						},
						oldTrack,
					);
					put(
						"music_track_identifier",
						`${entry.path}/id`,
						{
							release_id: releaseId,
							track_id: trackId,
							namespace: "musicbrainz.track",
							value: entry.track.id,
						},
						previousTrack
							? oldAt("music_track_identifier", `${previousTrack.path}/id`)
							: recoverAt("music_track_identifier", `${entry.path}/id`),
					);
				}
				const claimedDiscs = new Set<number>();
				for (const [discIndex, disc] of (medium.discs ?? []).entries()) {
					const oldDiscIndex =
						oldMedium?.discs?.findIndex(
							(candidate, candidateIndex) =>
								!claimedDiscs.has(candidateIndex) && isDeepStrictEqual(candidate, disc),
						) ?? -1;
					let oldDisc: Baseline | undefined = recoverAt(
						"music_medium_toc",
						`/media/${index}/discs/${discIndex}`,
					);
					let tocId: string;
					if (oldDiscIndex >= 0) {
						claimedDiscs.add(oldDiscIndex);
						oldDisc = oldAt("music_medium_toc", `/media/${oldIndex}/discs/${oldDiscIndex}`);
						tocId = z.uuid().parse(oldDisc.value.toc_id);
					} else if (oldDisc) {
						tocId = z.uuid().parse(oldDisc.value.toc_id);
					} else {
						const [toc] = await tx
							.insert(musicDiscToc)
							.values({
								discId: disc.id,
								trackCount: disc["offset-count"],
								leadoutOffset: disc.sectors,
							})
							.returning({ id: musicDiscToc.id });
						if (!toc) throw new Error("Disc TOC insertion returned no row");
						tocId = toc.id;
						await tx
							.insert(musicDiscTocOffset)
							.values(disc.offsets.map((offset, position) => ({ tocId, position, offset })));
					}
					put(
						"music_medium_toc",
						`/media/${index}/discs/${discIndex}`,
						{ release_id: releaseId, medium_id: mediumId, toc_id: tocId },
						oldDisc,
					);
				}
			}
			const previousEvents =
				previous["release-events"] ?? (previous.date ? [{ date: previous.date }] : []);
			const incomingEvents =
				incoming["release-events"] ?? (incoming.date ? [{ date: incoming.date }] : []);
			for (const [index, event] of incomingEvents.entries()) {
				const path = incoming["release-events"] ? `/release-events/${index}` : "/date";
				const old = previousEvents[index]
					? oldAt(
							"music_release_event",
							previous["release-events"] ? `/release-events/${index}` : "/date",
						)
					: recoverAt("music_release_event", path);
				let areaId: string | null = null;
				if (event.area)
					areaId = (
						await musicBrainzAreaReference(
							tx,
							context.actor,
							observation,
							event.area,
							`${path}/area`,
							"prepared",
						)
					).id;

				const date = musicBrainzDate(event.date);
				put(
					"music_release_event",
					path,
					{
						release_id: releaseId,
						id: old?.componentKey ?? crypto.randomUUID(),
						area_id: areaId,
						date_year: date.year,
						date_month: date.month,
						date_day: date.day,
						date_text: event.date ?? null,
					},
					old,
				);
			}
			for (const [index, label] of (incoming["label-info"] ?? []).entries()) {
				const path = `/label-info/${index}`;
				const old = previous["label-info"]?.[index]
					? oldAt("music_release_label", path)
					: recoverAt("music_release_label", path);
				let labelId: string | null = null;
				if (label.label)
					labelId = (
						await musicBrainzLabelReference(
							tx,
							context.actor,
							observation,
							label.label,
							`${path}/label`,
							"prepared",
						)
					).id;

				put(
					"music_release_label",
					path,
					{
						release_id: releaseId,
						id: old?.componentKey ?? crypto.randomUUID(),
						label_id: labelId,
						catalog_number: label["catalog-number"] ?? null,
					},
					old,
				);
			}
			const result = await finish();
			const names = await applyMusicBrainzNameDelta(
				tx,
				context.reference,
				context.actor,
				result.revision,
				context.sourceRecordId,
				context.mappingKey,
				context.previousSnapshotId,
				context.snapshotId,
				previous,
				incoming,
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
					record: { annotation: previous.annotation, disambiguation: previous.disambiguation },
				},
				{ annotation: incoming.annotation, disambiguation: incoming.disambiguation },
			);
			const identifierEntries = (record: typeof incoming) =>
				record.asin ? [{ namespace: "asin", value: record.asin, path: "/asin" }] : [];
			const identifiers = await applyCatalogSourceIdentifierDelta(
				tx,
				context.reference,
				context.actor,
				facts.revision,
				{ ...context, previousSnapshotId: context.previousSnapshotId },
				identifierEntries(previous),
				identifierEntries(incoming),
			);
			const relations = await applyMusicBrainzRelationDelta(
				tx,
				context.reference,
				context.actor,
				identifiers.revision,
				observation,
				{
					snapshotId: context.previousSnapshotId,
					mappingKey: context.mappingKey,
					relations: previous.relations ?? [],
				},
				incoming.relations ?? [],
			);
			return {
				revision: relations.revision,
				changes: [
					...result.changes.map((change) => ({
						kind: "music-component" as const,
						ownerId: releaseId,
						...change,
					})),
					...names.changes,
					...facts.changes,
					...identifiers.changes,
					...relations.changes,
				],
			};
		});
}
