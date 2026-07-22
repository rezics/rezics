import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const enrichmentPath = fileURLToPath(
	new URL("../../../search/rezics_unit_search_document_v3.sql", import.meta.url),
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
});
