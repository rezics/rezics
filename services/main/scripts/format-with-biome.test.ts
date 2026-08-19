import { describe, expect, it } from "vitest";

import { formatWithBiome } from "./format-with-biome";

describe("formatWithBiome", () => {
	it("formats through the workspace-pinned Biome CLI without a PATH command name", async () => {
		const formatted = await formatWithBiome('{"z":1,"a":2}', "document.json");
		expect(formatted).toBe('{ "z": 1, "a": 2 }\n');
	});
});
