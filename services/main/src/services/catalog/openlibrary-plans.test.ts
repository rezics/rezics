import { describe, it, expect } from "vitest";
import { OpenLibraryContractSha256, OpenLibraryDocumentSchema } from "./openlibrary";
import { prepareOpenLibraryArchive, openLibraryReferences } from "./openlibrary-runtime";
import {
	openLibraryContributors,
	openLibraryIdentifiers,
	openLibraryNames,
	openLibraryPhysicalFormat,
} from "./openlibrary-plans";
import { openLibraryLanguageTag } from "./openlibrary-language";
import { storeCatalogSourcePayload } from "./source-observations";

describe("OpenLibrary complete native source planning", () => {
	const work = {
		key: "/works/OL1W",
		type: { key: "/type/work" },
		title: "Work",
		authors: [
			{
				author: { key: "/authors/OL1A" },
				type: { key: "/type/author_role" },
				role: "editor",
				as: "Printed name",
			},
		],
		original_languages: [{ key: "/languages/fre" }],
		translated_titles: [{ language: { key: "/languages/eng" }, text: "Translated work" }],
		extension: { unreviewed: [1, 2] },
	};
	it("preserves role and credited name without treating the type tag as a role", () => {
		const record = OpenLibraryDocumentSchema.parse({ kind: "work", record: work });
		expect(openLibraryContributors(record)[0]).toMatchObject({
			role: "editor",
			creditedAs: "Printed name",
			path: "/authors/0/author/key",
		});
		expect(openLibraryReferences(record)).toEqual([
			{ key: "/authors/OL1A", path: "/authors/0/author/key", owner: "entity", shape: "unresolved" },
		]);
	});
	it("keeps contribution identity across array reorder while retaining observed order", () => {
		const first = OpenLibraryDocumentSchema.parse({
			kind: "work",
			record: { ...work, authors: [...work.authors, { author: { key: "/authors/OL2A" } }] },
		});
		const second = OpenLibraryDocumentSchema.parse({
			kind: "work",
			record: { ...work, authors: [{ author: { key: "/authors/OL2A" } }, ...work.authors] },
		});
		expect(openLibraryContributors(first)[0]?.identity).toBe(
			openLibraryContributors(second)[1]?.identity,
		);
		expect(openLibraryContributors(second)[1]?.position).toBe(1);
	});
	it("normalizes bibliographic ISO aliases without inventing a text version", () => {
		expect(openLibraryLanguageTag("/languages/fre")).toBe("fr");
		const record = OpenLibraryDocumentSchema.parse({ kind: "work", record: work });
		expect(openLibraryNames(record)[1]?.value).toMatchObject({
			value: "Translated work",
			languageTag: "en",
			origin: "translation",
			translationMethod: "unknown",
		});
		const publication = OpenLibraryDocumentSchema.parse({
			kind: "edition",
			record: {
				key: "/books/OL1M",
				type: { key: "/type/edition" },
				title: "Publication",
				languages: [{ key: "/languages/jpn" }],
				translation_of: "Original title",
			},
		});
		expect(openLibraryReferences(publication)).toEqual([]);
	});
	it("retains plural identifiers and marks no unrecognized format as a known native facet", () => {
		const record = OpenLibraryDocumentSchema.parse({
			kind: "edition",
			record: {
				key: "/books/OL1M",
				type: { key: "/type/edition" },
				title: "Publication",
				isbn_10: ["0306406152"],
				isbn_13: ["9780306406157"],
				lccn: ["2001000001"],
				identifiers: { custom: ["opaque"] },
				table_of_contents: [{ label: "I", title: "First", pagenum: "x", level: 0 }],
			},
		});
		expect(openLibraryIdentifiers(record)).toHaveLength(5);
		expect(openLibraryPhysicalFormat("Hardback")).toBe("hardcover");
		expect(openLibraryPhysicalFormat("Unreviewed carrier")).toBeNull();
	});
	it("verifies archived bytes and exact source identity while retaining extension evidence", async () => {
		const bytes = new TextEncoder().encode(JSON.stringify(work));
		const receipt = await storeCatalogSourcePayload(
			{ source: "openlibrary", objectType: "work", externalId: "/works/OL1W" },
			bytes,
			OpenLibraryContractSha256,
			null,
			{ put: async () => {}, get: async () => ({}) },
		);
		expect(prepareOpenLibraryArchive({ receipt, bytes }).record.extension).toEqual({
			unreviewed: [1, 2],
		});
		expect(() =>
			prepareOpenLibraryArchive({
				receipt: { ...receipt, key: { ...receipt.key, externalId: "/works/OL2W" } },
				bytes,
			}),
		).toThrow(/identity/);
		expect(() => prepareOpenLibraryArchive({ receipt, bytes: new Uint8Array([1]) })).toThrow(
			/bytes/,
		);
	});
});
