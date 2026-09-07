import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";

export const VndbCatalogContractSha256 =
	"138e258e3475aa669b9c928922d817051bcdc84ffda96c7457e731ee72672bd4";
export const VndbDumpContractSha256 =
	"d3bd70446cd39cc5bf0bfb0a3c3c2fd8031ab0ffc897a28da4b64001a77a5b31";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const vnReference = z.object({ id: z.string().regex(/^v\d+$/u) }).passthrough();
const text = (maximum: number) =>
	z
		.string()
		.refine(
			(value) => Buffer.byteLength(value, "utf8") <= maximum,
			"VNDB text exceeds byte budget",
		);
const image = z
	.object({
		id: z.string(),
		url: z.url(),
		dims: z.tuple([integer, integer]),
		sexual: z.number().min(0).max(2).optional(),
		violence: z.number().min(0).max(2).optional(),
		votecount: integer.optional(),
		thumbnail: z.url().optional(),
		thumbnail_dims: z.tuple([integer, integer]).optional(),
	})
	.passthrough();
const externalLink = z
	.object({ url: z.url(), label: z.string(), name: z.string(), id: z.union([z.string(), integer]) })
	.passthrough();
const staffReference = z
	.object({
		id: z.string().regex(/^s\d+$/u),
		aid: integer.optional(),
		name: text(131072).optional(),
		original: text(131072).nullable().optional(),
	})
	.passthrough();

export const VndbVnSchema = z
	.object({
		id: z.string().regex(/^v\d+$/u),
		title: z.string(),
		titles: z
			.array(
				z
					.object({
						lang: z.string(),
						title: z.string(),
						latin: z.string().nullable(),
						official: z.boolean(),
						main: z.boolean(),
					})
					.passthrough(),
			)
			.optional(),
		aliases: z.array(z.string()).optional(),
		alttitle: text(131072).nullable().optional(),
		description: text(524288).nullable().optional(),
		devstatus: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
		released: z.string().nullable().optional(),
		platforms: z.array(z.string()).max(128).optional(),
		length: z.number().int().min(1).max(5).nullable().optional(),
		length_votes: integer.optional(),
		average: z.number().min(10).max(100).nullable().optional(),
		rating: z.number().min(10).max(100).nullable().optional(),
		popularity: z.number().finite().nullable().optional(),
		votecount: integer.optional(),
		image: image.nullable().optional(),
		screenshots: z
			.array(
				image.extend({
					release: z
						.object({ id: z.string().regex(/^r\d+$/u) })
						.passthrough()
						.optional(),
				}),
			)
			.max(4096)
			.optional(),
		extlinks: z.array(externalLink).max(4096).optional(),
		olang: z.string().optional(),
		languages: z.array(z.string()).optional(),
		editions: z
			.array(
				z
					.object({
						eid: integer,
						lang: z.string().nullable(),
						name: z.string(),
						official: z.boolean(),
					})
					.passthrough(),
			)
			.max(128)
			.refine(
				(editions) => new Set(editions.map(({ eid }) => eid)).size === editions.length,
				"Duplicate snapshot-local participation key",
			)
			.optional(),
		staff: z
			.array(
				z
					.object({
						id: z.string().regex(/^s\d+$/u),
						aid: integer,
						name: text(131072).optional(),
						original: text(131072).nullable().optional(),
						eid: integer.nullable(),
						role: z.string(),
						note: z.string().nullable(),
					})
					.passthrough(),
			)
			.max(4096)
			.optional(),
		va: z
			.array(
				z
					.object({
						staff: staffReference,
						character: z.object({ id: z.string().regex(/^c\d+$/u) }).passthrough(),
						note: z.string().nullable(),
					})
					.passthrough(),
			)
			.max(4096)
			.optional(),
		length_minutes: integer.nullable().optional(),
	})
	.passthrough();

export const VndbReleaseSchema = z
	.object({
		id: z.string().regex(/^r\d+$/u),
		title: z.string(),
		alttitle: text(131072).nullable().optional(),
		platforms: z.array(text(96)).max(128).optional(),
		media: z
			.array(z.object({ medium: text(96), qty: integer }).passthrough())
			.max(128)
			.optional(),
		resolution: z
			.union([
				z.literal("non-standard"),
				z.tuple([z.number().int().min(1).max(2147483647), z.number().int().min(1).max(2147483647)]),
			])
			.nullable()
			.optional(),
		engine: text(4096).nullable().optional(),
		voiced: z.number().int().min(1).max(4).nullable().optional(),
		minage: z.number().int().min(0).max(18).nullable().optional(),
		uncensored: z.boolean().nullable().optional(),
		official: z.boolean().optional(),
		has_ero: z.boolean().optional(),
		notes: text(524288).nullable().optional(),
		gtin: text(128).nullable().optional(),
		catalog: text(4096).nullable().optional(),
		extlinks: z.array(externalLink).max(4096).optional(),
		images: z
			.array(
				image.extend({
					type: z.enum(["pkgfront", "pkgback", "pkgcontent", "pkgside", "pkgmed", "dig"]),
					vn: z
						.string()
						.regex(/^v\d+$/u)
						.nullable(),
					languages: z.array(z.string()).nullable(),
					photo: z.boolean(),
				}),
			)
			.max(4096)
			.optional(),
		patch: z.boolean().optional(),
		freeware: z.boolean().optional(),
		languages: z
			.array(
				z
					.object({
						lang: z.string(),
						title: z.string().nullable().optional(),
						latin: z.string().nullable().optional(),
						main: z.boolean(),
						mtl: z.boolean(),
					})
					.passthrough(),
			)
			.optional(),
		vns: z
			.array(vnReference.extend({ rtype: z.enum(["trial", "partial", "complete"]).optional() }))
			.max(4096)
			.optional(),
		released: z.string().nullable().optional(),
	})
	.passthrough();

/** VNDB's two nonstandard labels are provider mappings, never global language aliases. */
export function vndbLanguage(value: string): string {
	return canonicalizeContentLanguageTag(value === "ta" ? "tl" : value === "ck" ? "chr" : value);
}

export function vndbSourceKey(id: string) {
	if (/^v\d+$/u.test(id)) return { source: "vndb", objectType: "vn", externalId: id } as const;
	if (/^r\d+$/u.test(id)) return { source: "vndb", objectType: "release", externalId: id } as const;
	if (/^s\d+$/u.test(id)) return { source: "vndb", objectType: "staff", externalId: id } as const;
	if (/^c\d+$/u.test(id))
		return { source: "vndb", objectType: "character", externalId: id } as const;
	if (/^p\d+$/u.test(id))
		return { source: "vndb", objectType: "producer", externalId: id } as const;
	if (/^g\d+$/u.test(id)) return { source: "vndb", objectType: "tag", externalId: id } as const;
	if (/^i\d+$/u.test(id)) return { source: "vndb", objectType: "trait", externalId: id } as const;
	if (/^q\d+$/u.test(id)) return { source: "vndb", objectType: "quote", externalId: id } as const;
	throw new TypeError("Unrecognized VNDB catalog identity");
}
