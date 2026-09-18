import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DatabaseTransaction } from "../database";
import { catalogSourceRecord, catalogSourceMappingClaim } from "@rezics/schema/postgres/ingestion/source";
import { CatalogIdentityTables } from "@rezics/schema/postgres/catalog/identity";
import { CatalogFactTables } from "@rezics/schema/postgres/knowledge/facts";
import { catalogAccessDecisions } from "../participation/policy";
import { catalogRatingReadable } from "./read-policy";
import { CatalogAccessDenied, CatalogReferenceNotFound } from "./storage";
import { catalogSourceRecordId } from "./source-record-key";

const cache = new AsyncLocalStorage<{ tx: DatabaseTransaction; actor: string; recordings: Map<string, { owner: "music"; id: string; revision: number; created: false }> }>();

/** @internal Cache entries are issued only after exact source correspondence and current native read authority are locked. */
export function cachedMusicBrainzRecording(tx: DatabaseTransaction, actor: string, input: { source: string; objectType: string; externalId: string; owner: string; shape: string }) {
	const current = cache.getStore();
	if (!current || current.tx !== tx || current.actor !== actor || input.source !== "musicbrainz" || input.objectType !== "recording") return undefined;
	if (input.owner !== "music" || input.shape !== "recording") throw new TypeError("Prepared recording reference has another native grain");
	return current.recordings.get(input.externalId);
}

/** @internal Source jobs bound and preauthorize target reads in 128-key pages before their native publication loop. */
export async function withPreparedMusicBrainzRecordings<T>(tx: DatabaseTransaction, actor: string, input: readonly string[], work: () => Promise<T>): Promise<T> {
	const ids = [...new Set(z.array(z.uuid()).max(16384).parse(input))];
	const recordings = new Map<string, { owner: "music"; id: string; revision: number; created: false }>();
	const record = catalogSourceRecord, claim = catalogSourceMappingClaim, binding = CatalogFactTables.music.sourceBinding, identity = CatalogIdentityTables.music;
	for (let offset = 0; offset < ids.length; offset += 128) {
		const page = ids.slice(offset, offset + 128);
		const rows = await tx.select({ externalId: record.externalId, sourceRecordId: record.id, identity }).from(record)
			.innerJoin(claim, and(eq(claim.sourceRecordId, record.id), eq(claim.path, "/"), eq(claim.owner, "music"), eq(claim.state, "active")))
			.innerJoin(binding, and(eq(binding.sourceRecordId, record.id), eq(binding.mappingKey, claim.mappingKey)))
			.innerJoin(identity, eq(identity.id, binding.ownerId))
			.where(and(inArray(record.id, page.map((externalId) => catalogSourceRecordId({ source: "musicbrainz", objectType: "recording", externalId }))), eq(record.source, "musicbrainz"), eq(record.objectType, "recording"), eq(identity.shape, "recording"), isNull(identity.deletedAt)))
			.limit(page.length).for("share", { of: [record, claim, binding, identity] });
		if (rows.length !== page.length || rows.some((row) => !catalogRatingReadable(row.identity.contentRating))) throw new CatalogReferenceNotFound("Prepared recording correspondence is unavailable");
		const allowed = await catalogAccessDecisions(tx, rows.map((row) => ({ reference: { owner: "music", id: row.identity.id }, createdByAuthUserId: row.identity.createdByAuthUserId })), actor, false);
		for (const [index, row] of rows.entries()) {
			if (!page.includes(row.externalId) || catalogSourceRecordId({ source: "musicbrainz", objectType: "recording", externalId: row.externalId }) !== row.sourceRecordId) throw new TypeError("Prepared recording source identity differs");
			if (!allowed[index] && (row.identity.visibility === "private" || row.identity.status !== "published" || row.identity.moderationStatus !== "approved")) throw new CatalogAccessDenied();
			recordings.set(row.externalId, { owner: "music", id: row.identity.id, revision: row.identity.revision, created: false });
		}
	}
	return cache.run({ tx, actor, recordings }, work);
}
