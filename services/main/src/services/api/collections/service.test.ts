import { describe, expect, it } from "vitest";

import { presentCollectionMembership } from "./service";

const Membership = {
	targetId: "00000000-0000-4000-8000-000000000001",
	position: "a0",
} as const;

describe("Collection content membership presentation", () => {
	it("normalizes the database timestamp", () => {
		expect(
			presentCollectionMembership({
				...Membership,
				createdAt: new Date("2025-11-01T15:24:47.327Z"),
			}),
		).toEqual({
			...Membership,
			createdAt: "2025-11-01T15:24:47.327Z",
		});
	});
});
