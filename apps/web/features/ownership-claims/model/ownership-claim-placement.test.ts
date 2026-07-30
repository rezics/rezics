import { describe, expect, it } from "vitest";

import { ownershipClaimPlacement } from "./ownership-claim-placement";

describe("ownership claim placement", () => {
	it("shows a public Entity claim outside the overflow menu", () => {
		expect(
			ownershipClaimPlacement({ unitType: "entity", ownershipMode: "community_owned" }),
		).toBe("external");
	});

	it.each(["book", "media", "software"])(
		"keeps a public %s claim in the overflow menu",
		(unitType) => {
			expect(ownershipClaimPlacement({ unitType, ownershipMode: "community_owned" })).toBe(
				"overflow",
			);
		},
	);

	it("does not offer claims for owned or unsupported entries", () => {
		expect(
			ownershipClaimPlacement({ unitType: "entity", ownershipMode: "profile_owned" }),
		).toBe("none");
		expect(
			ownershipClaimPlacement({ unitType: "series", ownershipMode: "community_owned" }),
		).toBe("none");
	});
});
