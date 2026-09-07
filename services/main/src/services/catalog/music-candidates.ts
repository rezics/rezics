import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import {
	musicCandidateToc,
	musicCandidateTrack,
	musicDiscToc,
	musicDiscTocOffset,
	musicReleaseCandidate,
} from "../database/schema/catalog-music";
import { type CatalogReference, CatalogReferenceSchema } from "./contracts";
import {
	addCatalogName,
	createCatalogIdentity,
	loadCatalogIdentity,
	recordCatalogChange,
} from "./storage";
import { MusicDiscTocInputSchema } from "./music-domain";

const candidateInput = z.strictObject({
	name: z.string().max(131072),
	creditedArtistText: z.string().max(131072).nullable().optional(),
	barcode: z.string().max(512).nullable().optional(),
	comment: z.string().max(131072).nullable().optional(),
});
async function requireCandidate(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	write = false,
) {
	const ref = CatalogReferenceSchema.parse(reference);
	if (ref.owner !== "music") throw new TypeError("Expected music candidate owner");
	const identity = await loadCatalogIdentity(tx, ref, actor, write);
	if (identity.shape !== "release_candidate")
		throw new TypeError("Expected incomplete release candidate");
	return identity;
}

/** @alpha Incomplete catalogue input carries no implied issuance or artist identity. */
export async function createMusicReleaseCandidate(
	tx: DatabaseTransaction,
	actor: string,
	input: z.input<typeof candidateInput>,
) {
	const value = candidateInput.parse(input);
	const identity = await createCatalogIdentity(
		tx,
		{ owner: "music", shape: "release_candidate" },
		actor,
	);
	await tx
		.insert(musicReleaseCandidate)
		.values({
			id: identity.id,
			creditedArtistText: value.creditedArtistText ?? null,
			barcode: value.barcode ?? null,
			comment: value.comment ?? null,
		});
	if (!value.name) return identity;
	const name = await addCatalogName(tx, identity, actor, identity.revision, {
		kind: "primary",
		languageTag: null,
		value: value.name,
	});
	return { ...identity, revision: name.revision };
}

export async function addMusicCandidateTrack(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: { position: number; name: string; creditedArtistText?: string | null },
) {
	const value = z
		.strictObject({
			position: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
			name: z.string().max(131072),
			creditedArtistText: z.string().max(131072).nullable().optional(),
		})
		.parse(input);
	await requireCandidate(tx, reference, actor, true);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"music.candidate.track.add",
	);
	const [row] = await tx
		.insert(musicCandidateTrack)
		.values({ candidateId: reference.id, ...value })
		.returning({ id: musicCandidateTrack.id });
	if (!row) throw new Error("Candidate track insertion returned no row");
	return { id: row.id, revision };
}

export async function attachMusicCandidateToc(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string,
	expectedRevision: number,
	input: z.input<typeof MusicDiscTocInputSchema>,
) {
	const value = MusicDiscTocInputSchema.parse(input);
	await requireCandidate(tx, reference, actor, true);
	const revision = await recordCatalogChange(
		tx,
		reference,
		actor,
		expectedRevision,
		"music.candidate.toc.attach",
	);
	const [row] = await tx
		.insert(musicDiscToc)
		.values({
			discId: value.discId ?? null,
			freeDbId: value.freeDbId ?? null,
			trackCount: value.offsets.length,
			leadoutOffset: value.leadoutOffset,
		})
		.returning({ id: musicDiscToc.id });
	if (!row) throw new Error("Candidate TOC insertion returned no row");
	await tx
		.insert(musicDiscTocOffset)
		.values(value.offsets.map((offset, position) => ({ tocId: row.id, position, offset })));
	await tx.insert(musicCandidateToc).values({ candidateId: reference.id, tocId: row.id });
	return { id: row.id, revision };
}

export async function readMusicReleaseCandidate(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
) {
	const identity = await requireCandidate(tx, reference, actor);
	const [row] = await tx
		.select()
		.from(musicReleaseCandidate)
		.where(eq(musicReleaseCandidate.id, reference.id))
		.limit(1);
	if (!row) throw new Error("Candidate native profile is missing");
	return { ...row, revision: identity.revision };
}

export async function listMusicCandidateTracks(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	afterPosition = -1,
	limit = 50,
) {
	await requireCandidate(tx, reference, actor);
	z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER).parse(afterPosition);
	z.number().int().min(1).max(100).parse(limit);
	return tx
		.select()
		.from(musicCandidateTrack)
		.where(
			and(
				eq(musicCandidateTrack.candidateId, reference.id),
				gt(musicCandidateTrack.position, afterPosition),
			),
		)
		.orderBy(musicCandidateTrack.position)
		.limit(limit);
}

export async function listMusicCandidateTocs(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	afterId?: string,
	limit = 50,
) {
	await requireCandidate(tx, reference, actor);
	if (afterId) z.uuid().parse(afterId);
	z.number().int().min(1).max(100).parse(limit);
	return tx
		.select({
			id: musicDiscToc.id,
			discId: musicDiscToc.discId,
			freeDbId: musicDiscToc.freeDbId,
			trackCount: musicDiscToc.trackCount,
			leadoutOffset: musicDiscToc.leadoutOffset,
		})
		.from(musicCandidateToc)
		.innerJoin(musicDiscToc, eq(musicDiscToc.id, musicCandidateToc.tocId))
		.where(
			and(
				eq(musicCandidateToc.candidateId, reference.id),
				afterId ? gt(musicCandidateToc.tocId, afterId) : undefined,
			),
		)
		.orderBy(musicCandidateToc.tocId)
		.limit(limit);
}

export async function readMusicCandidateTocOffsets(
	tx: DatabaseTransaction,
	reference: CatalogReference,
	actor: string | null,
	tocId: string,
) {
	await requireCandidate(tx, reference, actor);
	z.uuid().parse(tocId);
	const [attachment] = await tx
		.select()
		.from(musicCandidateToc)
		.where(and(eq(musicCandidateToc.candidateId, reference.id), eq(musicCandidateToc.tocId, tocId)))
		.limit(1);
	if (!attachment) throw new TypeError("Candidate TOC attachment is missing");
	return tx
		.select()
		.from(musicDiscTocOffset)
		.where(eq(musicDiscTocOffset.tocId, tocId))
		.orderBy(musicDiscTocOffset.position)
		.limit(99);
}
