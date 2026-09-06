import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";

export const VndbCatalogContractSha256 =
	"138e258e3475aa669b9c928922d817051bcdc84ffda96c7457e731ee72672bd4";
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const vnReference = z.object({ id: z.string().regex(/^v\d+$/u) }).passthrough();
const staffReference = z
	.object({ id: z.string().regex(/^s\d+$/u), aid: integer.optional() })
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
			.optional(),
		staff: z
			.array(
				z
					.object({
						id: z.string().regex(/^s\d+$/u),
						aid: integer,
						eid: integer.nullable(),
						role: z.string(),
						note: z.string().nullable(),
					})
					.passthrough(),
			)
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
			.optional(),
		length_minutes: z.number().finite().nullable().optional(),
	})
	.passthrough();

export const VndbReleaseSchema = z
	.object({
		id: z.string().regex(/^r\d+$/u),
		title: z.string(),
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
		vns: z.array(vnReference).optional(),
		released: z.string().optional(),
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
	throw new TypeError("Unrecognized VNDB catalog identity");
}
