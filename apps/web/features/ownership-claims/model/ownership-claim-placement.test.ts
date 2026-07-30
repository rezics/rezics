import { describe, expect, it } from "vitest";

import { ownershipClaimPlacement } from "./ownership-claim-placement";

describe("ownership claim placement", () => {
	it("shows a public Entity claim outside the overflow menu", () => {
		expect(ownershipClaimPlacement({ unitType: "entity", catalogMode: "public_entry" })).toBe(
			"external",
		);
	});

	it.each(["book", "media", "software"])(
		"keeps a public %s claim in the overflow menu",
		(unitType) => {
			expect(ownershipClaimPlacement({ unitType, catalogMode: "public_entry" })).toBe(
				"overflow",
			);
		},
	);

	it("does not offer claims for owned or unsupported entries", () => {
		expect(ownershipClaimPlacement({ unitType: "entity", catalogMode: "owned_work" })).toBe(
			"none",
		);
		expect(ownershipClaimPlacement({ unitType: "series", catalogMode: "public_entry" })).toBe(
			"none",
		);
	});
});
