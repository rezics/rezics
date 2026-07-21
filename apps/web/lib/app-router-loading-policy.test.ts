import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("App Router loading boundaries", () => {
	it("keeps loading UI below the root layout", () => {
		const rootLoadingBoundaries = ["js", "jsx", "ts", "tsx"].map(
			(extension) => new URL(`../app/loading.${extension}`, import.meta.url),
		);

		expect(rootLoadingBoundaries.some((boundary) => existsSync(boundary))).toBe(false);
	});
});
