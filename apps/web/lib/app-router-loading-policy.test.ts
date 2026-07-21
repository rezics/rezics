import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const LoadingExtensions = ["js", "jsx", "ts", "tsx"] as const;

function hasLoadingBoundary(segment: string): boolean {
	return LoadingExtensions.some((extension) =>
		existsSync(new URL(`../app/${segment}loading.${extension}`, import.meta.url)),
	);
}

describe("App Router loading boundaries", () => {
	it("keeps the root free of loading UI that would replace route-group shells", () => {
		expect(hasLoadingBoundary("")).toBe(false);
	});

	it("provides a general fallback inside the application shell", () => {
		expect(hasLoadingBoundary("(app)/")).toBe(true);
	});
});
