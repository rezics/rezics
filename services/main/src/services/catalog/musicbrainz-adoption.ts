import { preflightMusicBrainzReleaseDelta } from "./musicbrainz-release-plan";
import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../database";
import { musicBrainzLanguageTag } from "./musicbrainz-language";
import {
	musicRecording,
	musicRelease,
	musicReleaseGroup,
	musicMedium,
	musicTrackOccurrence,
	musicMediumIdentifier,
	musicTrackIdentifier,
} from "../database/schema/catalog-music";
import { acceptCatalogSourceInitialization } from "./source-bindings";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { createCatalogIdentity } from "./storage";
import {
	musicBrainzCreditWriter,
	musicBrainzVocabulary,
	projectMusicBrainzReleaseMetadata,
	projectMusicBrainzDiscs,
	projectMusicBrainzGroupTypes,
	projectMusicBrainzIdentifiers,
} from "./musicbrainz-native";
import { adoptMusicBrainzRelations } from "./musicbrainz-relations";
import { adoptMusicBrainzAliases, adoptMusicBrainzTitle } from "./musicbrainz-names";
import { recordMusicSourceComponent } from "./music-source-occurrences";
import { applyMusicBrainzFactDelta } from "./musicbrainz-facts";
import { inspectExistingSourceBinding } from "./source-adoption";
import { bindReferencedSourceIdentity } from "./source-references";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import {
	MusicBrainzCatalogContractSha256,
	MusicBrainzReleaseSchema,
	musicBrainzSourceKey,
} from "./musicbrainz";

/** Release, media and track identity are projected separately; inline records retain parent evidence. */
export async function adoptMusicBrainzRelease(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256
	)
		throw new Error("MusicBrainz projection bytes differ from the archived observation");
	if (receipt.contractSha256 !== MusicBrainzCatalogContractSha256)
		throw new Error("MusicBrainz source contract has not been reviewed for this mapper");
	const record = MusicBrainzReleaseSchema.parse(
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	if (
		receipt.key.source !== "musicbrainz" ||
		receipt.key.objectType !== "release" ||
		receipt.key.externalId !== record.id
	)
		throw new TypeError("MusicBrainz release differs from its source key");
	preflightMusicBrainzReleaseDelta(record, record);
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		observation,
		"musicbrainz.release.1",
	);
	if (existing && existing.status !== "initialize_reference") return existing;
	if (existing && existing.reference.owner !== "music")
		throw new TypeError("MusicBrainz source resolves to another catalog owner");
	const identity = existing
		? { ...existing.reference, revision: existing.revision }
		: await createCatalogIdentity(tx, { owner: "music", shape: "release" }, actor);
	await prepareCatalogSourceChildCorrespondence(tx, actor, {
		sourceRecordId: observation.record.id,
		snapshotId: observation.snapshot.id,
		reference: identity,
		mappingVersion: "musicbrainz.release.1",
	});
	const creditId = musicBrainzCreditWriter(tx, actor, observation, identity);
	let releaseGroupId: string | null = null;
	if (record["release-group"]) {
		const group = await bindReferencedSourceIdentity(tx, actor, {
			...musicBrainzSourceKey("release_group", record["release-group"].id),
			owner: "music",
			shape: "release_group",
			name: record["release-group"].title,
			evidence: observation.referenceAt("/release-group/id"),
		});
		if (group.created) {
			await tx.insert(musicReleaseGroup).values({
				id: group.id,
				artistCreditId: await creditId(
					record["release-group"]["artist-credit"],
					"/release-group/artist-credit",
				),
				primaryTypeRevisionId: await musicBrainzVocabulary(
					tx,
					"release_group_primary_type",
					record["release-group"]["primary-type-id"],
					record["release-group"]["primary-type"],
					{
						actor,
						observation,
						idPath: "/release-group/primary-type-id",
						namePath: "/release-group/primary-type",
					},
				),
			});
			await projectMusicBrainzGroupTypes(tx, group.id, record["release-group"], undefined, {
				actor,
				observation,
				path: "/release-group",
			});
			await adoptMusicBrainzRelations(
				tx,
				actor,
				group,
				group.revision,
				observation,
				record["release-group"].relations ?? [],
				"/release-group/relations",
			);
		}
		releaseGroupId = group.id;
	}
	const releaseCredit = await creditId(record["artist-credit"], "/artist-credit");
	await tx.insert(musicRelease).values({
		id: identity.id,
		releaseGroupId,
		artistCreditId: releaseCredit,
		statusRevisionId: await musicBrainzVocabulary(
			tx,
			"release_status",
			record["status-id"],
			record.status,
			{ actor, observation, idPath: "/status-id", namePath: "/status" },
		),
		packagingRevisionId: await musicBrainzVocabulary(
			tx,
			"release_packaging",
			record["packaging-id"],
			record.packaging,
			{ actor, observation, idPath: "/packaging-id", namePath: "/packaging" },
		),
		languageTag: record["text-representation"]?.language
			? musicBrainzLanguageTag(record["text-representation"].language)
			: null,
		scriptCode: record["text-representation"]?.script || null,
		barcode: record.barcode ?? null,
	});
	await projectMusicBrainzReleaseMetadata(tx, actor, observation, identity.id, record);
	await recordMusicSourceComponent(tx, observation, identity.id, "music_release", identity.id, "/");
	if (record.asin)
		await projectMusicBrainzIdentifiers(
			tx,
			identity.id,
			"asin",
			[record.asin],
			observation,
			"/asin",
		);
	let revision = identity.revision;
	if (record.title)
		revision = await adoptMusicBrainzTitle(
			tx,
			actor,
			identity,
			revision,
			observation,
			record.title,
		);
	if (!existing)
		await tx.insert(CatalogFactTables.music.identifier).values({
			ownerId: identity.id,
			namespace: "musicbrainz.release",
			value: record.id,
			normalizedValue: record.id,
		});
	for (const [mediumPosition, sourceMedium] of record.media.entries()) {
		const [medium] = await tx
			.insert(musicMedium)
			.values({
				releaseId: identity.id,
				position: sourceMedium.position,
				name: sourceMedium.title ?? null,
				sourceTrackCount: sourceMedium["track-count"] ?? null,
				formatRevisionId: await musicBrainzVocabulary(
					tx,
					"medium_format",
					sourceMedium["format-id"],
					sourceMedium.format,
					{
						actor,
						observation,
						idPath: `/media/${mediumPosition}/format-id`,
						namePath: `/media/${mediumPosition}/format`,
					},
				),
			})
			.returning({ id: musicMedium.id });
		if (!medium) throw new Error("MusicBrainz medium insertion returned no row");
		await recordMusicSourceComponent(
			tx,
			observation,
			identity.id,
			"music_medium",
			medium.id,
			`/media/${mediumPosition}`,
		);
		if (sourceMedium.id)
			await tx.insert(musicMediumIdentifier).values({
				releaseId: identity.id,
				mediumId: medium.id,
				namespace: "musicbrainz.medium",
				value: sourceMedium.id,
			});
		if (sourceMedium.id)
			await recordMusicSourceComponent(
				tx,
				observation,
				identity.id,
				"music_medium_identifier",
				`${medium.id}/musicbrainz.medium/${sourceMedium.id}`,
				`/media/${mediumPosition}/id`,
			);
		await projectMusicBrainzDiscs(tx, identity.id, medium.id, sourceMedium.discs ?? [], {
			observation,
			path: `/media/${mediumPosition}/discs`,
		});
		const tracks = [
			...(sourceMedium.pregap
				? [{ track: sourceMedium.pregap, path: `/media/${mediumPosition}/pregap`, data: false }]
				: []),
			...(sourceMedium.tracks ?? []).map((track, position) => ({
				track,
				path: `/media/${mediumPosition}/tracks/${position}`,
				data: false,
			})),
			...(sourceMedium["data-tracks"] ?? []).map((track, position) => ({
				track,
				path: `/media/${mediumPosition}/data-tracks/${position}`,
				data: true,
			})),
		];
		for (const { track: sourceTrack, path, data } of tracks) {
			const target = await bindReferencedSourceIdentity(tx, actor, {
				...musicBrainzSourceKey("recording", sourceTrack.recording.id),
				owner: "music",
				shape: "recording",
				name: sourceTrack.recording.title,
				evidence: observation.referenceAt(`${path}/recording/id`),
			});
			if (target.created) {
				await tx.insert(musicRecording).values({
					id: target.id,
					lengthMilliseconds: sourceTrack.recording.length ?? null,
					video: sourceTrack.recording.video ?? null,
					artistCreditId: await creditId(
						sourceTrack.recording["artist-credit"],
						`${path}/recording/artist-credit`,
					),
				});
				await projectMusicBrainzIdentifiers(
					tx,
					target.id,
					"isrc",
					sourceTrack.recording.isrcs ?? [],
					observation,
					`${path}/recording/isrcs`,
				);
				await adoptMusicBrainzRelations(
					tx,
					actor,
					target,
					target.revision,
					observation,
					sourceTrack.recording.relations ?? [],
					`${path}/recording/relations`,
				);
			}
			const [track] = await tx
				.insert(musicTrackOccurrence)
				.values({
					releaseId: identity.id,
					mediumId: medium.id,
					recordingId: target.id,
					position: sourceTrack.position,
					number: sourceTrack.number,
					isDataTrack: data,
					name: sourceTrack.title,
					lengthMilliseconds: sourceTrack.length ?? null,
					artistCreditId: await creditId(sourceTrack["artist-credit"], `${path}/artist-credit`),
				})
				.returning({ id: musicTrackOccurrence.id });
			if (!track) throw new Error("MusicBrainz track insertion returned no row");
			await recordMusicSourceComponent(
				tx,
				observation,
				identity.id,
				"music_track_occurrence",
				track.id,
				path,
			);
			await tx.insert(musicTrackIdentifier).values({
				releaseId: identity.id,
				trackId: track.id,
				namespace: "musicbrainz.track",
				value: sourceTrack.id,
			});
			await recordMusicSourceComponent(
				tx,
				observation,
				identity.id,
				"music_track_identifier",
				`${track.id}/musicbrainz.track/${sourceTrack.id}`,
				`${path}/id`,
			);
		}
	}
	revision = await adoptMusicBrainzAliases(
		tx,
		actor,
		identity,
		revision,
		observation,
		record.aliases ?? [],
	);
	revision = await adoptMusicBrainzRelations(
		tx,
		actor,
		identity,
		revision,
		observation,
		record.relations ?? [],
	);
	revision = (
		await applyMusicBrainzFactDelta(tx, identity, actor, revision, observation, null, {
			annotation: record.annotation,
			disambiguation: record.disambiguation,
		})
	).revision;
	if (existing)
		await acceptCatalogSourceInitialization(tx, actor, {
			sourceRecordId: observation.record.id,
			path: "/",
			snapshotId: observation.snapshot.id,
			reference: identity,
			expectedBaselineRevision: existing.revision,
			finalRevision: revision,
		});
	else
		await sealCatalogSourceChildCorrespondence(tx, actor, {
			sourceRecordId: observation.record.id,
			path: "/",
			snapshotId: observation.snapshot.id,
			reference: identity,
		});

	return {
		status: "created" as const,
		reference: { owner: "music" as const, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}
