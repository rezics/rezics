import { createHash } from "node:crypto";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { MusicBrainzCatalogContractSha256 } from "./musicbrainz";
import {
	createMusicReleaseCandidate,
	addMusicCandidateTrack,
	attachMusicCandidateToc,
} from "./music-candidates";
import { bindCatalogSourceIdentity } from "./source-bindings";
import { inspectExistingSourceBinding } from "./source-adoption";
import { type CatalogSourceReceipt, recordCatalogSourceDocument } from "./source-observations";

const id = z.number().int().positive().max(2147483647);
const text = z.string().max(131072);

/**
 * @alpha Pinned release_raw/track_raw/cdtoc_raw catalog join, admitted one candidate at a time.
 * @remarks Numeric dump row keys are local to the archived snapshot, not artist/recording MBIDs.
 * Source counters/timestamps remain observations and never become native ratings or lifecycle.
 */
export const MusicBrainzDumpCandidateSchema = z
	.object({
		id,
		title: text,
		artist: text.nullable().optional(),
		barcode: text.nullable().optional(),
		comment: text.optional(),
		tracks: z
			.array(
				z
					.object({
						id,
						release: id,
						title: text,
						artist: text.nullable().optional(),
						sequence: z.number().int().min(0),
					})
					.passthrough(),
			)
			.max(8192),
		tocs: z
			.array(
				z
					.object({
						id,
						release: id,
						discid: z.string().length(28),
						track_count: z.number().int().min(1).max(99),
						leadout_offset: z.number().int().positive(),
						track_offset: z.array(z.number().int().min(0)).min(1).max(99),
					})
					.passthrough(),
			)
			.max(4096),
	})
	.passthrough()
	.superRefine((value, context) => {
		if (
			value.tracks.some((track) => track.release !== value.id) ||
			value.tocs.some((toc) => toc.release !== value.id)
		)
			context.addIssue({
				code: "custom",
				message: "Candidate join crosses source release identity",
			});
		if (new Set(value.tracks.map((track) => track.sequence)).size !== value.tracks.length)
			context.addIssue({ code: "custom", message: "Duplicate candidate track sequence" });
		if (
			new Set(value.tracks.map((track) => track.id)).size !== value.tracks.length ||
			new Set(value.tocs.map((toc) => toc.id)).size !== value.tocs.length
		)
			context.addIssue({ code: "custom", message: "Duplicate dump row identity" });
		for (const toc of value.tocs)
			if (
				toc.track_count !== toc.track_offset.length ||
				toc.track_offset.some(
					(offset, position) =>
						offset >= toc.leadout_offset ||
						(position > 0 && offset <= (toc.track_offset[position - 1] ?? -1)),
				)
			)
				context.addIssue({ code: "custom", message: "Invalid candidate TOC" });
	});

/** Incomplete CD stubs remain private reviewable candidates with native track and TOC structure. */
export async function adoptMusicBrainzDumpCandidate(
	tx: DatabaseTransaction,
	actor: string,
	receipt: CatalogSourceReceipt,
	bytes: Uint8Array,
) {
	if (
		bytes.byteLength > 8_000_000 ||
		createHash("sha256").update(bytes).digest("hex") !== receipt.contentSha256 ||
		receipt.contractSha256 !== MusicBrainzCatalogContractSha256
	)
		throw new TypeError("Candidate source bytes or reviewed contract do not match");
	const record = MusicBrainzDumpCandidateSchema.parse(
		JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
	);
	if (
		receipt.key.source !== "musicbrainz" ||
		receipt.key.objectType !== "release_raw" ||
		receipt.key.externalId !== String(record.id)
	)
		throw new TypeError("Candidate source key does not match the dump row");
	const observation = await recordCatalogSourceDocument(tx, receipt, bytes);
	const existing = await inspectExistingSourceBinding(
		tx,
		actor,
		observation,
		"musicbrainz.release_raw.1",
	);
	if (existing) return existing;
	const identity = await createMusicReleaseCandidate(tx, actor, {
		name: record.title,
		creditedArtistText: record.artist ?? null,
		barcode: record.barcode ?? null,
		comment: record.comment ?? null,
	});
	let revision = identity.revision;
	for (const track of record.tracks)
		revision = (
			await addMusicCandidateTrack(tx, identity, actor, revision, {
				position: track.sequence,
				name: track.title,
				creditedArtistText: track.artist ?? null,
			})
		).revision;
	for (const toc of record.tocs)
		revision = (
			await attachMusicCandidateToc(tx, identity, actor, revision, {
				discId: toc.discid,
				offsets: toc.track_offset,
				leadoutOffset: toc.leadout_offset,
			})
		).revision;
	await bindCatalogSourceIdentity(tx, actor, {
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
