import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
	tagExpressionProjectionRetryDelayMilliseconds,
	TagExpressionProjectionBatchSize,
} from "./projection-worker";

describe("Tag Expression projection worker", () => {
	it("uses bounded keyset pages and lock-skipping claims", async () => {
		const source = await readFile(new URL("./projection-worker.ts", import.meta.url), "utf8");
		expect(source).toContain('for("update", { skipLocked: true })');
		expect(source).toContain(`limit(TagExpressionProjectionBatchSize + 1)`);
		expect(source).toContain("refresh_unit_effective_tags");
		expect(source).toContain("refresh_realm_unit_effective_tags");
		expect(source.toLowerCase()).not.toContain("offset(");
		expect(TagExpressionProjectionBatchSize).toBe(500);
	});

	it("backs off failed pages without creating an unbounded delay", () => {
		expect(tagExpressionProjectionRetryDelayMilliseconds(1)).toBe(1_000);
		expect(tagExpressionProjectionRetryDelayMilliseconds(4)).toBe(8_000);
		expect(tagExpressionProjectionRetryDelayMilliseconds(100)).toBe(60_000);
		expect(() => tagExpressionProjectionRetryDelayMilliseconds(0)).toThrow(RangeError);
	});
});
