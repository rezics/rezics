import { isDeepStrictEqual } from "node:util";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { entityCatalogProfile } from "../database/schema/catalog-entity";
import { referenceArea } from "../database/schema/catalog-reference";
import {
	musicComponentRevision,
	musicComponentSourceOccurrence,
	musicDiscToc,
	musicDiscTocOffset,
	musicRecording,
	musicReleaseGroup,
} from "../database/schema/catalog-music";
import {
	MusicBrainzCatalogContractSha256,
	MusicBrainzReleaseSchema,
	musicBrainzDate,
	musicBrainzSourceKey,
} from "./musicbrainz";
import { musicBrainzCreditWriter, musicBrainzVocabulary } from "./musicbrainz-native";
import { bindReferencedSourceIdentity } from "./source-references";
import { loadCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import { resolveMusicSourceComponentBaseline } from "./music-source-baselines";
import { applyMusicBrainzNameDelta } from "./musicbrainz-name-delta";
import { compensateCatalogSourceOwnedChange } from "./source-owned-compensation";
import {
	readCatalogSourceApplication,
	type CatalogSourceNativeChange,
} from "./source-applications";
import type { CatalogSourceNativeWriter } from "./source-proposals";
import { mutateMusicComponents, compensateMusicComponents } from "./music-structure";
import {
	MusicComponentChangeSchema,
	MusicComponentKeys,
	MusicComponentNameSchema,
	MusicComponentSchemas,
	type MusicComponentMutation,
	type MusicComponentName,
} from "./music-structure-contracts";
import { recordCatalogChange, loadCatalogIdentity } from "./storage";

import {
	tracks,
	correlateMusicBrainzMedia,
	preflightMusicBrainzReleaseDelta,
} from "./musicbrainz-release-plan";

type Archived = { receipt: CatalogSourceReceipt; bytes: Uint8Array };
type Baseline = {
	component: MusicComponentName;
	componentKey: string;
	sourcePath: string;
	historyId: string;
	currentHistoryId: string;
	value: Record<string, unknown>;
};

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
		outer.transaction(async (tx) => {
			if (context.reference.owner !== "music" || context.mappingVersion !== "musicbrainz.release.1")
				throw new TypeError("Music release writer received another mapping");
			if (context.action === "withdraw") {
				const application = await readCatalogSourceApplication(tx, context.actor, {
					sourceRecordId: context.sourceRecordId,
					proposalId: context.proposalId,
					action: "apply",
				});
				if (!application) throw new Error("Source application has no native compensation journal");
				const inverse: CatalogSourceNativeChange[] = [];
				for (const change of [...application.changes].reverse()) {
					if (change.kind === "music-component") continue;
					if (
						!("owner" in change) ||
						change.owner !== "music" ||
						change.ownerId !== context.reference.id
					)
						throw new TypeError("Music compensation targets another native owner");
					inverse.push(await compensateCatalogSourceOwnedChange(tx, context.actor, change));
				}
				const changes = application.changes
					.filter((change) => change.kind === "music-component")
					.map((change) => {
						if (change.ownerId !== context.reference.id)
							throw new TypeError("Music compensation journal targets another owner");
						return MusicComponentChangeSchema.parse({
							component: change.component,
							componentKey: change.componentKey,
							beforeRevisionId: change.beforeRevisionId,
							afterRevisionId: change.afterRevisionId,
						});
					});
				const current = await loadCatalogIdentity(tx, context.reference, context.actor, true);
				const result = changes.length
					? await compensateMusicComponents(
							tx,
							context.reference,
							context.actor,
							current.revision,
							changes,
						)
					: {
							revision: await recordCatalogChange(
								tx,
								context.reference,
								context.actor,
								current.revision,
								"music.source.withdraw",
							),
							changes: [],
						};
				return {
					revision: result.revision,
					changes: [
						...inverse,
						...result.changes.map((change) => ({
							kind: "music-component" as const,
							ownerId: context.reference.id,
							...change,
						})),
					],
				};
			}
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
			const occurrence = musicComponentSourceOccurrence;
			const history = musicComponentRevision;
			const rows = await tx
				.select({
					component: occurrence.component,
					componentKey: occurrence.componentKey,
					sourcePath: occurrence.sourcePath,
					historyId: occurrence.historyId,
					value: history.value,
				})
				.from(occurrence)
				.innerJoin(
					history,
					and(eq(history.ownerId, occurrence.ownerId), eq(history.id, occurrence.historyId)),
				)
				.where(
					and(
						eq(occurrence.sourceRecordId, context.sourceRecordId),
						eq(occurrence.snapshotId, context.previousSnapshotId),
						eq(occurrence.ownerId, context.reference.id),
					),
				)
				.limit(129);
			if (rows.length > 128)
				throw new RangeError("Music source occurrence scope requires staged application");
			const baseline = new Map<string, Baseline>();
			for (const row of rows) {
				const component = MusicComponentNameSchema.parse(row.component);
				baseline.set(`${component}:${row.sourcePath}`, {
					...row,
					component,
					currentHistoryId: await resolveMusicSourceComponentBaseline(tx, {
						sourceRecordId: context.sourceRecordId,
						mappingKey: context.mappingKey,
						ownerId: context.reference.id,
						component,
						componentKey: row.componentKey,
						sourceHistoryId: row.historyId,
					}),
				});
			}
			const oldAt = (component: MusicComponentName, path: string) => {
				const old = baseline.get(`${component}:${path}`);
				if (!old)
					throw new TypeError(`Missing exact native source occurrence: ${component} ${path}`);
				return old;
			};
			const used = new Set<string>();
			const pending: {
				component: MusicComponentName;
				componentKey: string;
				path: string;
				historyId?: string;
			}[] = [];
			const operations: MusicComponentMutation[] = [];
			const put = (component: MusicComponentName, path: string, value: unknown, old?: Baseline) => {
				const row: Record<string, unknown> = MusicComponentSchemas[component].parse(value);
				const componentKey = MusicComponentKeys[component].map((key) => row[key]).join("/");
				if (old) used.add(`${component}:${old.sourcePath}`);
				if (old && isDeepStrictEqual(old.value, row))
					pending.push({ component, componentKey, path, historyId: old.historyId });
				else {
					operations.push({
						action: "put",
						component,
						componentKey,
						expectedRevisionId: old?.currentHistoryId ?? null,
						value: row,
					});
					pending.push({ component, componentKey, path });
				}
			};
			const credit = musicBrainzCreditWriter(tx, context.actor, observation);
			const releaseId = context.reference.id;
			const root = oldAt("music_release", "/");
			let releaseGroupId = root.value.release_group_id;
			if (incoming["release-group"]?.id !== previous["release-group"]?.id) {
				const group = incoming["release-group"];
				if (!group) releaseGroupId = null;
				else {
					const target = await bindReferencedSourceIdentity(tx, context.actor, {
						...musicBrainzSourceKey("release_group", group.id),
						owner: "music",
						shape: "release_group",
						name: group.title,
						evidence: observation.referenceAt("/release-group/id"),
					});
					if (target.created) await tx.insert(musicReleaseGroup).values({ id: target.id });
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
						: await credit(incoming["artist-credit"], "/artist-credit"),
					status_revision_id: await musicBrainzVocabulary(
						tx,
						"release_status",
						incoming["status-id"],
						incoming.status,
					),
					packaging_revision_id: await musicBrainzVocabulary(
						tx,
						"release_packaging",
						incoming["packaging-id"],
						incoming.packaging,
					),
					language_tag: incoming["text-representation"]?.language
						? canonicalizeContentLanguageTag(incoming["text-representation"].language)
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
				const old = oldIndex == null ? undefined : oldAt("music_medium", `/media/${oldIndex}`);
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
							: undefined,
					);
				for (const entry of tracks(medium, index)) {
					const previousTrack = oldTracks.get(entry.track.id);
					const oldTrack = previousTrack
						? oldAt("music_track_occurrence", previousTrack.path)
						: undefined;
					const trackId = oldTrack?.componentKey ?? crypto.randomUUID();
					let recordingId = oldTrack?.value.recording_id;
					if (!previousTrack || previousTrack.track.recording.id !== entry.track.recording.id) {
						const target = await bindReferencedSourceIdentity(tx, context.actor, {
							...musicBrainzSourceKey("recording", entry.track.recording.id),
							owner: "music",
							shape: "recording",
							name: entry.track.recording.title,
							evidence: observation.referenceAt(`${entry.path}/recording/id`),
						});
						if (target.created)
							await tx
								.insert(musicRecording)
								.values({
									id: target.id,
									lengthMilliseconds: entry.track.recording.length ?? null,
									video: entry.track.recording.video ?? null,
									artistCreditId: await credit(
										entry.track.recording["artist-credit"],
										`${entry.path}/recording/artist-credit`,
									),
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
						previousTrack ? oldAt("music_track_identifier", `${previousTrack.path}/id`) : undefined,
					);
				}
				const claimedDiscs = new Set<number>();
				for (const [discIndex, disc] of (medium.discs ?? []).entries()) {
					const oldDiscIndex =
						oldMedium?.discs?.findIndex(
							(candidate, candidateIndex) =>
								!claimedDiscs.has(candidateIndex) && isDeepStrictEqual(candidate, disc),
						) ?? -1;
					let oldDisc: Baseline | undefined;
					let tocId: string;
					if (oldDiscIndex >= 0) {
						claimedDiscs.add(oldDiscIndex);
						oldDisc = oldAt("music_medium_toc", `/media/${oldIndex}/discs/${oldDiscIndex}`);
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
					: undefined;
				let areaId: string | null = null;
				if (event.area) {
					const area = await bindReferencedSourceIdentity(tx, context.actor, {
						...musicBrainzSourceKey("area", event.area.id),
						owner: "reference",
						shape: "area",
						name: event.area.name,
						evidence: observation.referenceAt(`${path}/area/id`),
					});
					areaId = area.id;
					if (area.created) await tx.insert(referenceArea).values({ id: areaId });
				}
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
					: undefined;
				let labelId: string | null = null;
				if (label.label) {
					const target = await bindReferencedSourceIdentity(tx, context.actor, {
						...musicBrainzSourceKey("label", label.label.id),
						owner: "entity",
						shape: "label",
						name: label.label.name,
						evidence: observation.referenceAt(`${path}/label/id`),
					});
					labelId = target.id;
					if (target.created)
						await tx.insert(entityCatalogProfile).values({ id: target.id, identityShape: "label" });
				}
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
			const removals = [...baseline]
				.filter(([key]) => !used.has(key))
				.map(([, row]) => ({
					action: "remove" as const,
					component: row.component,
					componentKey: row.componentKey,
					expectedRevisionId: row.currentHistoryId,
				}));
			const removalRank: Record<MusicComponentName, number> = {
				music_release: 9,
				music_medium: 8,
				music_track_occurrence: 6,
				music_release_label: 0,
				music_release_event: 0,
				music_release_presentation: 7,
				music_medium_presentation: 5,
				music_track_presentation: 0,
				music_medium_toc: 0,
				music_track_identifier: 0,
				music_medium_identifier: 0,
			};
			removals.sort((left, right) => removalRank[left.component] - removalRank[right.component]);
			const plan = [...removals, ...operations];
			if (plan.length > 128)
				throw new RangeError("Music release delta requires staged native activation");
			const result = plan.length
				? await mutateMusicComponents(
						tx,
						context.reference,
						context.actor,
						context.expectedRevision,
						plan,
					)
				: {
						revision: await recordCatalogChange(
							tx,
							context.reference,
							context.actor,
							context.expectedRevision,
							"music.source.observed",
						),
						changes: [],
					};
			const changed = new Map(
				result.changes.map((change) => [
					`${change.component}:${change.componentKey}`,
					change.afterRevisionId,
				]),
			);
			for (const row of pending) {
				const historyId = row.historyId ?? changed.get(`${row.component}:${row.componentKey}`);
				if (!historyId) throw new Error("Projected source occurrence has no exact native history");
				await tx
					.insert(occurrence)
					.values({
						sourceRecordId: context.sourceRecordId,
						snapshotId: context.snapshotId,
						ownerId: releaseId,
						component: row.component,
						componentKey: row.componentKey,
						sourcePath: row.path,
						historyId,
					});
			}
			const names = await applyMusicBrainzNameDelta(
				tx,
				context.reference,
				context.actor,
				result.revision,
				context.sourceRecordId,
				context.previousSnapshotId,
				context.snapshotId,
				previous,
				incoming,
			);
			return {
				revision: names.revision,
				changes: [
					...result.changes.map((change) => ({
						kind: "music-component" as const,
						ownerId: releaseId,
						...change,
					})),
					...names.changes,
				],
			};
		});
}
