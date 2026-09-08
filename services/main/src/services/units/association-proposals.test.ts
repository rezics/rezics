import { describe, expect, it } from "vitest";

import {
	associationProposalState,
	sourceAssociationScope,
	presentAssociationProposal,
} from "./association-proposals";

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
	it("exposes consent data without private principal/grant or routing payload", () => {
		const now = new Date("2030-01-01T00:00:00Z"),
			authId = "019f7c24-7a80-7000-8000-000000000009";
		const record = {
			id: "019f7c24-7a80-7000-8000-000000000001",
			sourceUnitId: "019f7c24-7a80-7000-8000-000000000002",
			targetUnitId: "019f7c24-7a80-7000-8000-000000000003",
			direction: "request" as const,
			createdByProfileId: "019f7c24-7a80-7000-8000-000000000004",
			expiresAt: new Date("2030-01-02T00:00:00Z"),
			resolution: null,
			resolvedAt: null,
			resolvedByProfileId: null,
			createdAt: now,
			updatedAt: now,
			kind: "credit" as const,
			role: "author" as const,
			contextPostId: null,
			creatorAuthUserId: authId,
			creatorAuthority: { principal: { kind: "auth", authUserId: authId } },
			sourceUnitPublishingId: "019f7c24-7a80-7000-8000-000000000002",
		};
		const visible = presentAssociationProposal(record, now);
		expect(visible.state).toBe("pending");
		expect(visible.role).toBe("author");
		expect(JSON.stringify(visible)).not.toContain(authId);
		expect(visible).not.toHaveProperty("creatorAuthority");
		expect(visible).not.toHaveProperty("sourceUnitPublishingId");
	});
});
