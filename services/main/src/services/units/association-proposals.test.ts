import { describe, expect, it } from "vitest";

import { associationProposalState, sourceAssociationScope } from "./association-proposals";

describe("Unit association proposal contract", () => {
	it("maps relationship kinds to source Unit mutation scopes", () => {
		expect(sourceAssociationScope("credit")).toEqual(["credit-attributions"]);
		expect(sourceAssociationScope("subject")).toEqual(["subject-associations"]);
	});

	it("derives expiry only while unresolved", () => {
		const now = new Date("2026-07-19T12:00:00.000Z");
		expect(
			associationProposalState(
				{ resolution: null, expiresAt: new Date("2026-07-19T11:00:00.000Z") },
				now,
			),
		).toBe("expired");
		expect(
			associationProposalState(
				{ resolution: "declined", expiresAt: new Date("2026-07-19T11:00:00.000Z") },
				now,
			),
		).toBe("declined");
	});
});
