import { describe, expect, it } from "vitest";

import { presentStoredRevisionPrimaryContribution } from "./revision-contribution";

describe("revision primary contribution storage", () => {
	it.each(["human", "unattributed"] as const)("presents %s without AI credit", (kind) => {
		expect(
			presentStoredRevisionPrimaryContribution({
				kind,
				creditedEntityId: null,
				role: null,
				assurance: null,
			}),
		).toEqual({ kind });
	});

	it("reconstructs the public AI credit union", () => {
		expect(
			presentStoredRevisionPrimaryContribution({
				kind: "ai",
				creditedEntityId: "019b0000-0000-7000-8000-000000000004",
				role: "editor",
				assurance: "self_declared",
			}),
		).toEqual({
			kind: "ai",
			creditAttribution: {
				creditedEntityId: "019b0000-0000-7000-8000-000000000004",
				role: "editor",
				assurance: "self_declared",
			},
		});
	});

	it("rejects an AI discriminator without a complete joined row", () => {
		expect(() =>
			presentStoredRevisionPrimaryContribution({
				kind: "ai",
				creditedEntityId: null,
				role: null,
				assurance: null,
			}),
		).toThrow("AI revision is missing its credit attribution");
	});

	it("rejects joined AI credit for a non-AI discriminator", () => {
		expect(() =>
			presentStoredRevisionPrimaryContribution({
				kind: "human",
				creditedEntityId: "019b0000-0000-7000-8000-000000000004",
				role: "editor",
				assurance: "self_declared",
			}),
		).toThrow("human revision cannot have AI credit attribution");
	});
});
