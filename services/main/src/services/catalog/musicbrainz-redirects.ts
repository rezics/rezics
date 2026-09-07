import { z } from "zod";
import { catalogSourceRecordId } from "./source-record-key";

/** @internal Pinned SQL *_gid_redirect tables, including secondary identities and SQL-only mood. */
export const MusicBrainzRedirectEntitySchema = z.enum(["area", "artist", "event", "genre", "instrument", "label", "place", "recording", "release", "release_group", "series", "work", "url", "mood", "artist_credit", "medium", "track"]);
const sqlId = z.number().int().positive().max(2147483647);
export const MusicBrainzRedirectDumpSchema = z.strictObject({
	entity: MusicBrainzRedirectEntitySchema,
	rows: z.array(z.strictObject({ gid: z.uuid(), new_id: sqlId, target: z.strictObject({ id: sqlId, gid: z.uuid() }), created: z.iso.datetime({ offset: true }).optional() })).min(1).max(128),
}).superRefine((value, context) => {
	const redirects = new Map<string, string>();
	for (const [position, row] of value.rows.entries()) {
		if (row.new_id !== row.target.id) context.addIssue({ code: "custom", path: ["rows", position], message: "Redirect target join does not match new_id" });
		if (row.gid === row.target.gid || redirects.has(row.gid)) context.addIssue({ code: "custom", path: ["rows", position], message: "Self or duplicate source redirect" });
		redirects.set(row.gid, row.target.gid);
	}
	for (const origin of redirects.keys()) {
		const seen = new Set<string>();
		let current: string | undefined = origin;
		while (current !== undefined) {
			if (seen.has(current)) { context.addIssue({ code: "custom", message: "Redirect batch contains a cycle" }); break; }
			seen.add(current); current = redirects.get(current);
		}
	}
});

/**
 * @internal Produce exact source-record edges for the shared redirect owner, without native rebinding.
 * @remarks The caller archives this bounded joined SQL document, registers its source/target records,
 * and supplies the resulting snapshot as evidence to recordCatalogSourceRedirect. Native reviews,
 * journal entries, identities and social data never move merely because the provider merged an MBID.
 */
export function planMusicBrainzRedirects(input: unknown) {
	const document = MusicBrainzRedirectDumpSchema.parse(input);
	return document.rows.map((row, position) => {
		const sourceKey = { source: "musicbrainz", objectType: document.entity, externalId: row.gid };
		const targetKey = { source: "musicbrainz", objectType: document.entity, externalId: row.target.gid };
		return { sourceKey, targetKey, sourceRecordId: catalogSourceRecordId(sourceKey), targetSourceRecordId: catalogSourceRecordId(targetKey), sourceTable: `${document.entity}_gid_redirect`, targetSourceRowId: row.new_id, evidencePath: `/rows/${position}`, sourceCreatedAt: row.created ?? null };
	});
}
