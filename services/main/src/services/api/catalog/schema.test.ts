import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { UpdateUnitTagCurationBody } from "./schema";

describe("Catalog API schemas", () => {
	it("requires a position exactly when a Unit Tag is pinned", () => {
		const updatedAt = "2026-07-28T12:00:00.000Z";
		const expectedFeaturedTagIds = ["018ff2b7-7c00-7000-8000-000000000001"];
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: true,
				position: "a0",
				updatedAt,
				expectedFeaturedTagIds,
			}),
		).toBe(true);
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: false,
				position: null,
				updatedAt,
				expectedFeaturedTagIds,
			}),
		).toBe(true);
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: true,
				position: null,
				updatedAt,
				expectedFeaturedTagIds,
			}),
		).toBe(false);
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: false,
				position: "a0",
				updatedAt,
				expectedFeaturedTagIds,
			}),
		).toBe(false);
		expect(
			Value.Check(UpdateUnitTagCurationBody, {
				pinned: false,
				position: null,
				updatedAt,
				expectedFeaturedTagIds,
				score: 10,
			}),
		).toBe(false);
	});
});
