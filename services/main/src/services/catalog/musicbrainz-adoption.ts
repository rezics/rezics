import { createHash } from "node:crypto";
import type { DatabaseTransaction } from "../database";
import { entityCatalogProfile } from "../database/schema/catalog-entity";
import {
	musicRecording,
	musicRelease,
	musicReleaseGroup,
	musicMedium,
	musicTrackOccurrence,
	musicMediumIdentifier,
	musicTrackIdentifier,
} from "../database/schema/catalog-music";
import { catalogSourceMappingClaim } from "../database/schema/catalog-source";
import { CatalogFactTables } from "../database/schema/catalog-facts";
import { createCatalogIdentity, addCatalogName } from "./storage";
import { beginMusicCredit, appendMusicCreditMembers, sealMusicCredit } from "./domains";
import { inspectExistingSourceBinding } from "./source-adoption";
import { bindReferencedSourceIdentity } from "./source-references";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";
import { appendSourceFieldObservation } from "./source-fields";
import {
	MusicBrainzCatalogContractSha256,
	MusicBrainzReleaseSchema,
	musicBrainzSourceKey,
	type MusicBrainzCredit,
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
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		observation,
		"musicbrainz.release.1",
	);
	if (existing) return existing;
	const creditCache = new Map<string, string>();
	const creditId = async (members: MusicBrainzCredit | undefined, path: string) => {
		if (!members?.length) return null;
		const signature = JSON.stringify(
			members.map((member) => [member.artist.id, member.name, member.joinphrase ?? ""]),
		);
		const cached = creditCache.get(signature);
		if (cached) return cached;
		const values = [];
		for (const [position, member] of members.entries()) {
			const shape =
				member.artist.type === "Person"
					? "person"
					: member.artist.type === "Character"
						? "character"
						: member.artist.type
							? "collective"
							: "unresolved";
			const person = await bindReferencedSourceIdentity(tx, actor, {
				...musicBrainzSourceKey("artist", member.artist.id),
				owner: "entity",
				shape,
				name: member.artist.name,
				evidence: observation.referenceAt(`${path}/${position}/artist/id`),
			});
			if (person.created)
				await tx.insert(entityCatalogProfile).values({ id: person.id, identityShape: shape });
			values.push({
				artist: person,
				creditedName: member.name,
				joinPhrase: member.joinphrase ?? "",
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
		creditCache.set(signature, id);
		return id;
	};
	let releaseGroupId: string | null = null;
	if (record["release-group"]) {
		const group = await bindReferencedSourceIdentity(tx, actor, {
			...musicBrainzSourceKey("release_group", record["release-group"].id),
			owner: "music",
			shape: "release_group",
			name: record["release-group"].title,
			evidence: observation.referenceAt("/release-group/id"),
		});
		if (group.created) await tx.insert(musicReleaseGroup).values({ id: group.id });
		releaseGroupId = group.id;
	}
	const releaseCredit = await creditId(record["artist-credit"], "/artist-credit");
	const identity = await createCatalogIdentity(tx, { owner: "music", shape: "release" }, actor);
	await tx
		.insert(musicRelease)
		.values({ id: identity.id, releaseGroupId, artistCreditId: releaseCredit });
	let revision = identity.revision;
	if (record.title)
		revision = (
			await addCatalogName(tx, identity, actor, revision, {
				kind: "source-primary",
				languageTag: null,
				value: record.title,
			})
		).revision;
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
			})
			.returning({ id: musicMedium.id });
		if (!medium) throw new Error("MusicBrainz medium insertion returned no row");
		await tx.insert(musicMediumIdentifier).values({
			releaseId: identity.id,
			mediumId: medium.id,
			namespace: "musicbrainz.medium",
			value: sourceMedium.id,
		});
		for (const [trackPosition, sourceTrack] of sourceMedium.tracks.entries()) {
			const path = `/media/${mediumPosition}/tracks/${trackPosition}`;
			const target = await bindReferencedSourceIdentity(tx, actor, {
				...musicBrainzSourceKey("recording", sourceTrack.recording.id),
				owner: "music",
				shape: "recording",
				name: sourceTrack.recording.title,
				evidence: observation.referenceAt(`${path}/recording/id`),
			});
			if (target.created)
				await tx.insert(musicRecording).values({
					id: target.id,
					lengthMilliseconds: sourceTrack.recording.length ?? null,
					video: sourceTrack.recording.video ?? null,
					artistCreditId: await creditId(
						sourceTrack.recording["artist-credit"],
						`${path}/recording/artist-credit`,
					),
				});
			const [track] = await tx
				.insert(musicTrackOccurrence)
				.values({
					releaseId: identity.id,
					mediumId: medium.id,
					recordingId: target.id,
					position: sourceTrack.position,
					number: sourceTrack.number,
					name: sourceTrack.title,
					lengthMilliseconds: sourceTrack.length ?? null,
					artistCreditId: await creditId(sourceTrack["artist-credit"], `${path}/artist-credit`),
				})
				.returning({ id: musicTrackOccurrence.id });
			if (!track) throw new Error("MusicBrainz track insertion returned no row");
			await tx.insert(musicTrackIdentifier).values({
				releaseId: identity.id,
				trackId: track.id,
				namespace: "musicbrainz.track",
				value: sourceTrack.id,
			});
		}
	}
	for (const [field, value] of Object.entries(record))
		revision = await appendSourceFieldObservation(tx, identity, actor, revision, {
			namespace: "source.musicbrainz.release",
			field,
			value,
			sourceRecordId: observation.record.id,
			snapshotId: observation.snapshot.id,
		});
	const [claim] = await tx
		.insert(catalogSourceMappingClaim)
		.values({
			sourceRecordId: observation.record.id,
			path: "/",
			owner: "music",
			observedSnapshotId: observation.snapshot.id,
		})
		.returning();
	if (!claim) throw new Error("MusicBrainz source binding returned no claim");
	await tx
		.insert(CatalogFactTables.music.sourceBinding)
		.values({ ownerId: identity.id, mappingKey: claim.mappingKey, mappingOwner: "music" });
	return {
		status: "created" as const,
		reference: { owner: "music" as const, id: identity.id },
		revision,
		snapshotId: observation.snapshot.id,
	};
}
