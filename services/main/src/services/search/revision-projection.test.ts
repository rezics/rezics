import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const revisionProjection = readFileSync(
	new URL("../../../search/rezics_revision_search_document_v1.sql", import.meta.url),
	"utf8",
);

describe("revision search projection", () => {
	it("removes suppressed revisions from the index", () => {
		expect(revisionProjection).toContain(
			"(revision_row.id IS NOT NULL AND NOT revision_row.suppressed) AS indexable",
		);
		expect(revisionProjection).toContain(
			"CASE WHEN revision_row.id IS NULL OR revision_row.suppressed THEN NULL",
		);
	});

	it("does not index protected content, summaries, or actor identities", () => {
		expect(revisionProjection).toContain(
			"CASE WHEN revision_row.content_hidden THEN '[]'::jsonb",
		);
		expect(revisionProjection).toContain("CASE WHEN revision_row.summary_hidden THEN ''");
		expect(revisionProjection).toContain("CASE WHEN revision_row.actor_hidden THEN NULL");
	});
});
