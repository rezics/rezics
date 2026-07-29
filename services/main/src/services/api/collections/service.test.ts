import { describe, expect, it } from "vitest";

import { presentCollectionMembership } from "./service";

const Membership = {
	targetId: "00000000-0000-4000-8000-000000000001",
	parentTargetId: null,
	position: "a0",
} as const;

describe("Collection content membership presentation", () => {
	it("validates and normalizes a raw PostgreSQL timestamp", () => {
		expect(
			presentCollectionMembership({
				...Membership,
				createdAt: "2025-11-01 15:24:47.327+00",
			}),
		).toEqual({
			...Membership,
			createdAt: "2025-11-01T15:24:47.327Z",
		});
	});

	it("rejects an invalid raw row before it reaches the response contract", () => {
		expect(() =>
			presentCollectionMembership({
				...Membership,
				createdAt: new Date("2025-11-01T15:24:47.327Z"),
			}),
		).toThrow("Collection membership query returned an invalid row");
		expect(() =>
			presentCollectionMembership({
				...Membership,
				createdAt: "not-a-timestamp",
			}),
		).toThrow("Collection membership query returned an invalid creation time");
	});
});
