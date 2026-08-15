import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { bookChapterDraftJob, contentStructureNode } from ".";

const dialect = new PgDialect();

describe("Book Chapter draft job schema", () => {
	it("has selective claim, lease, active-Book, and structure keyset indexes", () => {
		const jobIndexes = getTableConfig(bookChapterDraftJob).indexes.map(({ config }) => config.name);
		expect(jobIndexes).toEqual(
			expect.arrayContaining([
				"book_chapter_draft_job_active_book_key",
				"book_chapter_draft_job_claim_idx",
				"book_chapter_draft_job_lease_idx",
			]),
		);
		expect(getTableConfig(contentStructureNode).indexes.map(({ config }) => config.name)).toContain(
			"content_structure_node_structure_id_idx",
		);
	});

	it("requires processing state and lease fields to agree", () => {
		const check = getTableConfig(bookChapterDraftJob).checks.find(
			({ name }) => name === "book_chapter_draft_job_lease_shape_check",
		);
		if (!check) throw new Error("Missing Book Chapter draft lease constraint");
		const rendered = dialect.sqlToQuery(check.value).sql.toLowerCase().replaceAll(/\s+/g, " ");
		expect(rendered).toContain("state");
		expect(rendered).toContain("lease_token");
		expect(rendered).toContain("lease_expires_at");
	});
});
