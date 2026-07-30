import { describe, expect, it } from "vitest";

import { OfficialProfileIds } from "../bootstrap/manifest";
import { isUnitOwnershipClaimEligible, unitOwnershipClaimState } from "./service";

describe("Unit ownership claim policy", () => {
	it.each(["entity", "book", "media", "software"])(
		"allows community-owned public %s entries",
		(kind) => {
			expect(
				isUnitOwnershipClaimEligible({
					kind,
					catalogMode: "public_entry",
					deletedAt: null,
					ownerProfileId: OfficialProfileIds.community,
				}),
			).toBe(true);
		},
	);

	it.each([
		{
			kind: "series",
			catalogMode: "public_entry",
			deletedAt: null,
			ownerProfileId: OfficialProfileIds.community,
		},
		{
			kind: "book",
			catalogMode: "owned_work",
			deletedAt: null,
			ownerProfileId: OfficialProfileIds.community,
		},
		{
			kind: "book",
			catalogMode: "public_entry",
			deletedAt: new Date(),
			ownerProfileId: OfficialProfileIds.community,
		},
		{
			kind: "book",
			catalogMode: "public_entry",
			deletedAt: null,
			ownerProfileId: "019b76da-a800-7300-8000-000000000099",
		},
	])("rejects ineligible claim target %#", (input) => {
		expect(isUnitOwnershipClaimEligible(input)).toBe(false);
	});

	it("derives pending state only from an unresolved workflow record", () => {
		expect(unitOwnershipClaimState({ resolution: null })).toBe("pending");
		expect(unitOwnershipClaimState({ resolution: "approved" })).toBe("approved");
		expect(unitOwnershipClaimState({ resolution: "superseded" })).toBe("superseded");
	});
});
