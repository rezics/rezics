import { describe, expect, it } from "vitest";

import { InvalidPaginationCursor } from "../pagination/errors";
import { decodeUnitOwnershipClaimCursor, encodeUnitOwnershipClaimCursor } from "./cursor";

const claimId = "019b76da-a800-7300-8000-000000000001";

describe("Unit ownership claim cursor", () => {
	it("round-trips the chronological boundary", () => {
		const boundary = {
			createdAt: new Date("2026-07-30T08:00:00.000Z"),
			id: claimId,
		};
		expect(decodeUnitOwnershipClaimCursor(encodeUnitOwnershipClaimCursor(boundary))).toEqual(
			boundary,
		);
	});

	it("rejects malformed or structurally invalid values", () => {
		expect(() => decodeUnitOwnershipClaimCursor("not-a-cursor")).toThrow(InvalidPaginationCursor);
		const wrongVersion = Buffer.from(
			JSON.stringify({
				v: 2,
				createdAt: "2026-07-30T08:00:00.000Z",
				id: claimId,
			}),
		).toString("base64url");
		expect(() => decodeUnitOwnershipClaimCursor(wrongVersion)).toThrow(InvalidPaginationCursor);
	});
});
