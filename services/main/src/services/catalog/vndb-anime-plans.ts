import { z } from "zod";
import type { CatalogSourceIdentifierDescriptor } from "./source-identifier-delta";
import type { VndbNativeNamePlan } from "./vndb-names-update";
import type { VndbSemanticPlan } from "./vndb-semantics-contracts";
const id = z.number().int().min(1).max(2147483647);
export const VndbAnimeSchema = z.object({
	id,
	ann_id: z.array(id).max(64).nullable(),
	mal_id: z.array(id).max(64).nullable(),
	type: z.enum(["tv", "ova", "mov", "oth", "web", "spe", "mv"]).nullable(),
	year: z.number().int().min(-32768).max(32767).nullable(),
	title_romaji: z.string().max(131072).nullable(),
	title_kanji: z.string().max(131072).nullable(),
});
export type VndbAnimeRecord = z.output<typeof VndbAnimeSchema>;
export const VndbAnimeProgramTypes = {
	tv: "television_series",
	ova: "original_video_animation",
	mov: "film",
	oth: "other_program",
	web: "web_program",
	spe: "television_special",
	mv: "music_video",
} as const;

/** @internal VNDB's mirror importer takes AniDB main titles without establishing a language or transliteration relation. */
export function planVndbAnimeNames(record: VndbAnimeRecord): VndbNativeNamePlan[] {
	const names: VndbNativeNamePlan[] = [];
	if (record.title_romaji)
		names.push({
			namespace: "vndb.anime.name",
			key: "anidb-main",
			path: "/title_romaji",
			fields: {
				value: record.title_romaji,
				languageTag: null,
				kind: "source-primary",
				origin: "unknown",
				primaryForLanguage: null,
			},
		});
	if (record.title_kanji)
		names.push({
			namespace: "vndb.anime.name",
			key: "anidb-japanese",
			path: "/title_kanji",
			fields: {
				value: record.title_kanji,
				languageTag: "ja",
				kind: "source-primary",
				origin: "original",
				primaryForLanguage: true,
			},
		});
	return names;
}

/** @internal Mirrored external identifiers are fallible claims under the VNDB dump receipt, never fetched-AniDB evidence. */
export function planVndbAnimeIdentifiers(
	record: VndbAnimeRecord,
): CatalogSourceIdentifierDescriptor[] {
	return [
		{ namespace: "anidb.anime", value: String(record.id), path: "/id" },
		...(record.ann_id ?? []).map((value, index) => ({
			namespace: "animenewsnetwork.anime",
			value: String(value),
			path: `/ann_id/${index}`,
		})),
		...(record.mal_id ?? []).map((value, index) => ({
			namespace: "myanimelist.anime",
			value: String(value),
			path: `/mal_id/${index}`,
		})),
	];
}

/** @internal The mirrored year comes from AniDB startdate; unknown is distinct from a fabricated full date. */
export function planVndbAnimeSemantics(record: VndbAnimeRecord): VndbSemanticPlan {
	return {
		facts: [
			{
				namespace: "catalog.metadata",
				key: "program-start-year",
				value: record.year,
				kind: "number",
				path: "/year",
			},
		],
		relations: [],
	};
}
