import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { runParticipationSavepoint } from "../participation/policy";
import {
	musicAlternativeTrack,
	musicMediumIdentifier,
	musicTrackIdentifier,
} from "../database/schema/catalog-music";
import type { CatalogReference } from "./contracts";
import { MusicBrainzCatalogContractSha256, musicBrainzSourceKey } from "./musicbrainz";
import { MusicBrainzAlternativeReleaseDumpSchema } from "./musicbrainz-alternative-contracts";
import { musicBrainzLanguageTag } from "./musicbrainz-language";
import { musicBrainzCreditWriter, musicBrainzVocabulary } from "./musicbrainz-native";
import { recordCatalogSourceDocument, type CatalogSourceReceipt } from "./source-observations";
import {
	prepareCatalogSourceChildCorrespondence,
	sealCatalogSourceChildCorrespondence,
} from "./source-child-correspondence";
import { bindReferencedSourceIdentity } from "./source-references";
import { inspectExistingSourceBinding } from "./source-adoption";
import { recordMusicSourceComponent } from "./music-source-occurrences";
import { mutateMusicComponents } from "./music-structure";
import type { MusicComponentMutation, MusicComponentName } from "./music-structure-contracts";
import { loadCatalogIdentity } from "./storage";

/** @alpha Adopt a reviewed SQL alternate tracklist on an already evidenced physical release. */
export async function adoptMusicBrainzAlternativeRelease(
	tx: DatabaseTransaction,
	release: CatalogReference,
	actor: string,
	expectedRevision: number,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	return runParticipationSavepoint(tx, async (inner) => {
		if (
			bytes.byteLength > 8000000 ||
			createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
			receipt.contractSha256 !== MusicBrainzCatalogContractSha256 ||
			receipt.key.source !== "musicbrainz" ||
			receipt.key.objectType !== "alternative_release"
		)
			throw new TypeError("Unreviewed alternative release source bytes");
		const record = MusicBrainzAlternativeReleaseDumpSchema.parse(
			JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
		);
		if (record.gid !== receipt.key.externalId)
			throw new TypeError("Alternative release differs from its archived identity");
		if (1 + record.media.reduce((count, medium) => count + 1 + medium.tracks.length, 0) > 128)
			throw new RangeError("Alternative tracklist requires staged source application");
		const native = await loadCatalogIdentity(inner, release, actor, true);
		if (release.owner !== "music" || native.shape !== "release")
			throw new TypeError("Expected native music release");
		const observation = await recordCatalogSourceDocument(inner, receipt, bytes);
		const existing = await inspectExistingSourceBinding(
			inner,
			actor,
			observation,
			"musicbrainz.alternative_release.1",
		);
		if (existing) return existing;
		await prepareCatalogSourceChildCorrespondence(inner, actor, {
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
			reference: release,
			mappingVersion: "musicbrainz.alternative_release.1",
		});
		const sourceRelease = await bindReferencedSourceIdentity(inner, actor, {
			...musicBrainzSourceKey("release", record.release.gid),
			owner: "music",
			shape: "release",
			evidence: observation.referenceAt("/release/gid"),
		});
		if (sourceRelease.created || sourceRelease.id !== release.id)
			throw new TypeError("Alternative tracklist must target its already adopted source release");
		const credit = musicBrainzCreditWriter(inner, actor, observation);
		const releasePresentationId = crypto.randomUUID();
		const operations: MusicComponentMutation[] = [];
		const evidence: { component: MusicComponentName; key: string; path: string }[] = [];
		const add = (component: MusicComponentName, key: string, path: string, value: unknown) => {
			operations.push({
				action: "put",
				component,
				componentKey: key,
				expectedRevisionId: null,
				value,
			});
			evidence.push({ component, key, path });
		};
		add("music_release_presentation", releasePresentationId, "/", {
			release_id: release.id,
			id: releasePresentationId,
			name: record.name,
			artist_credit_id: await credit(record["artist-credit"], "/artist-credit"),
			language_tag: record.language ? musicBrainzLanguageTag(record.language) : null,
			script_code: record.script,
			type_revision_id: await musicBrainzVocabulary(
				inner,
				"alternative_release_type",
				record.type.gid,
				record.type.name,
				{ actor, observation, idPath: "/type/gid", namePath: "/type/name" },
			),
			comment: record.comment || null,
		});
		const alternates = new Map<number, string>();
		for (const [mediumIndex, medium] of record.media.entries()) {
			const media = await inner
				.select()
				.from(musicMediumIdentifier)
				.where(
					and(
						eq(musicMediumIdentifier.releaseId, release.id),
						eq(musicMediumIdentifier.namespace, "musicbrainz.medium"),
						eq(musicMediumIdentifier.value, medium.medium.gid),
					),
				)
				.limit(2);
			if (media.length !== 1 || !media[0])
				throw new TypeError("Alternative tracklist medium MBID is missing or ambiguous");
			const mediumId = media[0].mediumId;
			const mediumPresentationId = crypto.randomUUID();
			add("music_medium_presentation", mediumPresentationId, `/media/${mediumIndex}`, {
				release_id: release.id,
				id: mediumPresentationId,
				release_presentation_id: releasePresentationId,
				medium_id: mediumId,
				name: medium.name,
			});
			for (const [trackIndex, track] of medium.tracks.entries()) {
				const trackIds = await inner
					.select()
					.from(musicTrackIdentifier)
					.where(
						and(
							eq(musicTrackIdentifier.releaseId, release.id),
							eq(musicTrackIdentifier.namespace, "musicbrainz.track"),
							eq(musicTrackIdentifier.value, track.track.gid),
						),
					)
					.limit(2);
				if (trackIds.length !== 1 || !trackIds[0])
					throw new TypeError("Alternative track MBID is missing or ambiguous");
				let alternativeTrackId = alternates.get(track.alternative_track.id);
				if (!alternativeTrackId) {
					const [alternative] = await inner
						.insert(musicAlternativeTrack)
						.values({
							name: track.alternative_track.name,
							artistCreditId: await credit(
								track.alternative_track["artist-credit"],
								`/media/${mediumIndex}/tracks/${trackIndex}/alternative_track/artist-credit`,
							),
						})
						.returning({ id: musicAlternativeTrack.id });
					if (!alternative) throw new Error("Alternative track insertion returned no row");
					alternativeTrackId = alternative.id;
					alternates.set(track.alternative_track.id, alternativeTrackId);
				}
				add(
					"music_track_presentation",
					`${mediumPresentationId}/${trackIds[0].trackId}`,
					`/media/${mediumIndex}/tracks/${trackIndex}`,
					{
						release_id: release.id,
						medium_presentation_id: mediumPresentationId,
						medium_id: mediumId,
						track_id: trackIds[0].trackId,
						alternative_track_id: alternativeTrackId,
					},
				);
			}
		}
		const result = await mutateMusicComponents(inner, release, actor, expectedRevision, operations);
		for (const row of evidence)
			await recordMusicSourceComponent(
				inner,
				observation,
				release.id,
				row.component,
				row.key,
				row.path,
			);
		await sealCatalogSourceChildCorrespondence(inner, actor, {
			sourceRecordId: observation.record.id,
			path: "/",
			snapshotId: observation.snapshot.id,
			reference: release,
		});
		return {
			status: "created" as const,
			reference: release,
			revision: result.revision,
			snapshotId: observation.snapshot.id,
		};
	});
}
