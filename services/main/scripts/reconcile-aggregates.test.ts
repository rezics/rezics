import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("aggregate reconciliation queries", () => {
	it("derives Favorites engagement from the current Profile relation", async () => {
		const source = await readFile(
			new URL("./reconcile-aggregates.ts", import.meta.url),
			"utf8",
		);

		expect(source).toContain("join profile_favorites_collection favorites");
		expect(source).toContain("favorites.collection_id = item.collection_id");
		expect(source).not.toContain("owner.source");
		expect(source).not.toContain("owner.system_key");
	});
});
