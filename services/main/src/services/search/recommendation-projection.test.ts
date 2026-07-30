import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const enrichmentPath = fileURLToPath(
	new URL("../../../search/rezics_unit_search_document_v9.sql", import.meta.url),
);
const workerPath = fileURLToPath(new URL("../recommendations/worker.ts", import.meta.url));

describe("recommendation search projection boundary", () => {
	it("invalidates current documents on activation without projecting private signals", async () => {
		const [enrichment, worker] = await Promise.all([
			readFile(enrichmentPath, "utf8"),
			readFile(workerPath, "utf8"),
		]);
		expect(worker).toContain("touch_search_unit_projection");
		expect(worker).not.toContain("touch_search_revision_projection");
		expect(enrichment).toContain("recommendation_unit_stat");
		expect(enrichment).toContain("snapshot.active AND snapshot.state = 'ready'");
		for (const privateSource of [
			"recommendation_profile_interest",
			"recommendation_exclusion",
			"recommendation_event",
		])
			expect(enrichment).not.toContain(privateSource);
	});

	it("projects one filterable subtype contract and exact Realm Tag context keys", async () => {
		const enrichment = await readFile(enrichmentPath, "utf8");
		expect(enrichment).toContain("'searchKind', CASE category.value");
		expect(enrichment).toContain("WHEN 'posts' THEN post_row.kind::text");
		expect(enrichment).toContain("WHEN 'reviews' THEN subject_unit_row.kind");
		expect(enrichment).toContain("'realmTagVoteKeys'");
		expect(enrichment).toContain("FROM public.realm_tag_vote_stat");
		expect(enrichment).not.toContain(
			"FROM public.realm_unit WHERE unit_id = source.unit_id AND realm_id",
		);
	});
});
