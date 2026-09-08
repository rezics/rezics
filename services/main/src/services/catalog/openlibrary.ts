import { z } from "zod";
import { CatalogPartialDateSchema } from "./contracts";
const reference = z.object({ key: z.string().min(1) }).passthrough();
const strings = z.array(z.string()).max(8192);
export const OpenLibraryTextSchema = z.union([
	z.string(),
	z.object({ type: z.string(), value: z.string() }).passthrough(),
]);
const links = z
	.array(
		z
			.object({ url: z.string(), title: z.string().optional(), type: reference.optional() })
			.passthrough(),
	)
	.max(8192);
const common = {
	title: z.string(),
	subtitle: z.string().optional(),
	other_titles: strings.optional(),
	description: OpenLibraryTextSchema.optional(),
	notes: OpenLibraryTextSchema.optional(),
	subjects: strings.optional(),
	covers: z.array(z.number().int()).max(8192).optional(),
	links: links.optional(),
	first_sentence: OpenLibraryTextSchema.optional(),
};
/** Known fields are typed; forward source extensions remain only in the immutable observation. */
export const OpenLibraryWorkSchema = z
	.object({
		...common,
		key: z.string().regex(/^\/works\/OL\d+W$/u),
		type: z.object({ key: z.literal("/type/work") }).passthrough(),
		authors: z
			.array(
				z
					.object({
						author: reference,
						type: reference.optional(),
						role: z.string().optional(),
						as: z.string().optional(),
					})
					.passthrough(),
			)
			.max(8192)
			.optional(),
		translated_titles: z
			.array(z.object({ language: reference, text: z.string() }).passthrough())
			.max(8192)
			.optional(),
		subject_places: strings.optional(),
		subject_times: strings.optional(),
		subject_people: strings.optional(),
		dewey_number: strings.optional(),
		lc_classifications: strings.optional(),
		original_languages: z.array(reference).max(8192).optional(),
		first_publish_date: z.string().optional(),
		cover_edition: reference.optional(),
	})
	.passthrough();
export const OpenLibraryEditionSchema = z
	.object({
		...common,
		key: z.string().regex(/^\/books\/OL\d+M$/u),
		type: z.object({ key: z.literal("/type/edition") }).passthrough(),
		title_prefix: z.string().optional(),
		works: z.array(reference).max(8192).optional(),
		authors: z.array(reference).max(8192).optional(),
		by_statement: z.string().optional(),
		publish_date: z.string().optional(),
		copyright_date: z.string().optional(),
		edition_name: z.string().optional(),
		languages: z.array(reference).max(8192).optional(),
		genres: strings.optional(),
		table_of_contents: z
			.array(
				z
					.object({
						class: z.string().optional(),
						level: z.number().int().nonnegative().optional(),
						label: z.string().optional(),
						title: z.string().optional(),
						pagenum: z.string().optional(),
					})
					.passthrough(),
			)
			.max(8192)
			.optional(),
		work_titles: strings.optional(),
		series: strings.optional(),
		physical_dimensions: z.string().optional(),
		physical_format: z.string().optional(),
		number_of_pages: z.number().int().nonnegative().safe().optional(),
		pagination: z.string().optional(),
		lccn: strings.optional(),
		ocaid: z.string().optional(),
		oclc_numbers: strings.optional(),
		isbn_10: strings.optional(),
		isbn_13: strings.optional(),
		identifiers: z.record(z.string(), strings).optional(),
		dewey_decimal_class: strings.optional(),
		lc_classifications: strings.optional(),
		classifications: z.record(z.string(), strings).optional(),
		contributions: strings.optional(),
		publish_places: strings.optional(),
		publish_country: z.string().optional(),
		publishers: strings.optional(),
		distributors: strings.optional(),
		weight: z.string().optional(),
		location: strings.optional(),
		scan_on_demand: z.boolean().optional(),
		collections: z.array(reference).max(8192).optional(),
		uris: strings.optional(),
		uri_descriptions: strings.optional(),
		translation_of: z.string().optional(),
		source_records: strings.optional(),
		translated_from: z.array(reference).max(8192).optional(),
		scan_records: z.array(reference).max(8192).optional(),
		volumes: z.array(z.record(z.string(), z.unknown())).max(8192).optional(),
		accompanying_material: z.string().optional(),
	})
	.passthrough();
/** Author records identify a contributor but do not establish a person/organization subtype or Auth account. */
export const OpenLibraryAuthorSchema = z
	.object({
		key: z.string().regex(/^\/authors\/OL\d+A$/u),
		type: z.object({ key: z.literal("/type/author") }).passthrough(),
		name: z.string(),
		eastern_order: z.boolean().optional(),
		personal_name: z.string().optional(),
		enumeration: z.string().optional(),
		title: z.string().optional(),
		alternate_names: strings.optional(),
		uris: strings.optional(),
		bio: OpenLibraryTextSchema.optional(),
		location: z.string().optional(),
		birth_date: z.string().optional(),
		death_date: z.string().optional(),
		date: z.string().optional(),
		wikipedia: z.string().optional(),
		links: links.optional(),
		remote_ids: z.record(z.string(), z.string()).optional(),
	})
	.passthrough();
export const OpenLibraryDocumentSchema = z.discriminatedUnion("kind", [
	z.strictObject({ kind: z.literal("work"), record: OpenLibraryWorkSchema }),
	z.strictObject({ kind: z.literal("edition"), record: OpenLibraryEditionSchema }),
	z.strictObject({ kind: z.literal("author"), record: OpenLibraryAuthorSchema }),
]);
export type OpenLibraryDocument = z.output<typeof OpenLibraryDocumentSchema>;
export type OpenLibraryWork = z.output<typeof OpenLibraryWorkSchema>;
export type OpenLibraryEdition = z.output<typeof OpenLibraryEditionSchema>;
export type OpenLibraryAuthor = z.output<typeof OpenLibraryAuthorSchema>;
export function openLibraryText(value: z.output<typeof OpenLibraryTextSchema> | undefined) {
	return typeof value === "string" ? value : value?.value;
}
/** Only explicit numeric precision is normalized; the source prose date is retained separately. */
export function openLibraryDate(value: string | undefined) {
	if (!value) return null;
	const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/u.exec(value);
	if (!match) return null;
	const date = CatalogPartialDateSchema.safeParse({
		year: Number(match[1]),
		month: match[2] ? Number(match[2]) : null,
		day: match[3] ? Number(match[3]) : null,
	});
	return date.success ? date.data : null;
}
export function openLibrarySourceKey(key: string) {
	if (/^\/works\/OL\d+W$/u.test(key))
		return { source: "openlibrary", objectType: "work", externalId: key } as const;
	if (/^\/books\/OL\d+M$/u.test(key))
		return { source: "openlibrary", objectType: "edition", externalId: key } as const;
	if (/^\/authors\/OL\d+A$/u.test(key))
		return { source: "openlibrary", objectType: "author", externalId: key } as const;
	throw new TypeError("Unrecognized Open Library object identity");
}

/** Pinned OpenLibrary type-contract source; mapper revisions are independent of archived bytes. */
export const OpenLibraryContractSha256 =
	"837ebff80ad04e255691c649c9058f86f23eb76bb139e87c05f01e09a53a17d7";
export const OpenLibraryMappingVersion = "openlibrary.dc153f22c728ad4e2e414867363805a032c64a6b.2";
