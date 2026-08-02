import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sequinSearchEnrichmentRelations } from "./search-enrichment-relations";

const enrichmentFiles = [
	new URL("../search/rezics_unit_search_document_v1.sql", import.meta.url),
	new URL("../search/rezics_revision_search_document_v1.sql", import.meta.url),
] as const;

function referencedRelations(source: string): readonly string[] {
	return [...source.matchAll(/\b(?:from|join)\s+(?:only\s+)?public\.([a-z][a-z0-9_]*)\b/giu)].map(
		(match) => {
			const relation = match[1];
			if (!relation) throw new TypeError("Search enrichment relation match is incomplete");
			return relation;
		},
	);
}

describe("Sequin search enrichment relation privileges", () => {
	it("cover every public relation read by the enrichment queries", () => {
		const configured = [...sequinSearchEnrichmentRelations].sort();
		const referenced = [
			...new Set(
				enrichmentFiles.flatMap((file) => referencedRelations(readFileSync(file, "utf8"))),
			),
		].sort();

		expect(configured).toEqual(referenced);
		expect(new Set(configured).size).toBe(configured.length);
	});
});
