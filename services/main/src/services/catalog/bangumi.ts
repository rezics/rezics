import { createHash } from "node:crypto";
import { z } from "zod";
import { CatalogPartialDateSchema } from "@rezics/schema/contracts/native/catalog";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Fully bundled upstream component graph recorded by the source-contract audit. */
export const BangumiSubjectContractSha256 =
	"1c60608e97a53129b6fa646e0813a2e02f2efcebbd0f9e3beb08488c02297c66";
export const BangumiWikiEntrySchema = z.strictObject({
	key: z.string(),
	// The pinned upstream WikiV0 incorrectly adds type: object around this union.
	value: z.union([
		z.string(),
		z.array(z.strictObject({ k: z.string().optional(), v: z.string() })),
	]),
});

/** Explicit public-subject contract, including the verified WikiV0 correction. */
export const BangumiSubjectSchema = z.strictObject({
	id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(6)]),
	name: z.string(),
	name_cn: z.string(),
	summary: z.string(),
	series: z.boolean(),
	nsfw: z.boolean(),
	locked: z.boolean(),
	date: z.string().optional(),
	platform: z.string(),
	images: z.strictObject({
		small: z.string(),
		grid: z.string(),
		large: z.string(),
		medium: z.string(),
		common: z.string(),
	}),
	infobox: z.array(BangumiWikiEntrySchema).optional(),
	volumes: count,
	eps: count,
	total_episodes: count,
	rating: z.strictObject({
		rank: count,
		total: count,
		score: z.number().finite(),
		count: z.partialRecord(z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]), count),
	}),
	collection: z.strictObject({
		wish: count,
		collect: count,
		doing: count,
		on_hold: count,
		dropped: count,
	}),
	tags: z.array(z.strictObject({ name: z.string(), count, total_count: count })),
	meta_tags: z.array(z.string()),
});
export type BangumiSubject = z.infer<typeof BangumiSubjectSchema>;

/** Every top-level field has a reviewed disposition; source observations are not local votes. */
export const BangumiSubjectFieldOwners = {
	id: "source-identity",
	type: "source-classification",
	name: "named-form",
	name_cn: "named-form",
	summary: "source-text",
	series: "grouping-grain",
	nsfw: "content-rating",
	locked: "source-observation",
	date: "source-date",
	platform: "source-classification",
	images: "source-media-descriptors",
	infobox: "ordered-source-properties",
	volumes: "source-metric",
	eps: "source-metric",
	total_episodes: "source-metric",
	rating: "source-statistics",
	collection: "source-statistics",
	tags: "source-tag-observations",
	meta_tags: "source-classification",
} as const satisfies Record<keyof BangumiSubject, string>;

export function parseBangumiSubject(value: unknown) {
	return BangumiSubjectSchema.parse(value);
}

/** Unknown/malformed source dates remain original observations, never invented precision. */
export function bangumiDate(value: string | undefined) {
	if (!value) return null;
	const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/u.exec(value);
	if (!match) return null;
	const result = CatalogPartialDateSchema.safeParse({
		year: Number(match[1]),
		month: match[2] ? Number(match[2]) : null,
		day: match[3] ? Number(match[3]) : null,
	});
	return result.success ? result.data : null;
}

export function planBangumiSubject(input: unknown) {
	const subject = parseBangumiSubject(input);
	const names = [
		...(subject.name ? [{ languageTag: null, kind: "source-primary", value: subject.name }] : []),
		...(subject.name_cn
			? [{ languageTag: "zh", kind: "source-translated", value: subject.name_cn }]
			: []),
	];
	const owner =
		subject.type === 1
			? subject.series
				? "grouping"
				: "publishing"
			: subject.type === 3
				? "music"
				: subject.type === 4
					? "software"
					: "program";
	const shape =
		subject.type === 1
			? subject.series
				? "grouping"
				: "catalog_entry"
			: subject.type === 3
				? "catalog_entry"
				: subject.type === 4
					? "content"
					: "program";
	return {
		subject,
		owner,
		shape,
		names,
		date: bangumiDate(subject.date),
		contentRating: subject.nsfw ? "r18" : "general",
		// Literal original payload is preserved by the caller before this plan is adopted.
		semanticSha256: createHash("sha256").update(JSON.stringify(subject)).digest("hex"),
	} as const;
}
