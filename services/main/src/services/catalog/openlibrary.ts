import { z } from "zod";
import { CatalogPartialDateSchema } from "./contracts";

const keyReference = z.strictObject({ key: z.string().min(1) });
const sourceText = z.union([z.string(), z.strictObject({ type: z.string(), value: z.string() })]);

/** Open Library records are extensible; additional values remain source observations. */
export const OpenLibraryWorkSchema = z
	.object({
		key: z.string().regex(/^\/works\/OL\d+W$/u),
		type: z.strictObject({ key: z.literal("/type/work") }),
		title: z.string(),
		subtitle: z.string().optional(),
		authors: z
			.array(z.object({ author: keyReference, type: keyReference.optional() }).passthrough())
			.optional(),
		description: sourceText.optional(),
		subjects: z.array(z.string()).optional(),
		first_publish_date: z.string().optional(),
	})
	.passthrough();

export const OpenLibraryEditionSchema = z
	.object({
		key: z.string().regex(/^\/books\/OL\d+M$/u),
		type: z.strictObject({ key: z.literal("/type/edition") }),
		title: z.string(),
		subtitle: z.string().optional(),
		works: z.array(keyReference).optional(),
		authors: z.array(keyReference).optional(),
		isbn_10: z.array(z.string()).optional(),
		isbn_13: z.array(z.string()).optional(),
		identifiers: z.record(z.string(), z.array(z.string())).optional(),
		languages: z.array(keyReference).optional(),
		publishers: z.array(z.string()).optional(),
		number_of_pages: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
		pagination: z.string().optional(),
		publish_date: z.string().optional(),
		publish_country: z.string().optional(),
		description: sourceText.optional(),
		notes: sourceText.optional(),
	})
	.passthrough();

export type OpenLibraryWork = z.infer<typeof OpenLibraryWorkSchema>;
export type OpenLibraryEdition = z.infer<typeof OpenLibraryEditionSchema>;

/** Only explicit numeric precision is normalized here; original prose dates are retained. */
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
