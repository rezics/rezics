import { describe, expect, it } from "vitest";

import { deriveUnitProgressState } from "./progress-state";

const authenticatedSource = {
	authenticated: true,
	record: null,
	recordError: null,
	recordFailed: false,
	recordMissing: false,
	recordPending: false,
	sessionPending: false,
} as const;

describe("unit progress state", () => {
	it("maps a missing progress resource to the actionable untracked state", () => {
		const progressNotFound = new Error("Progress not found");

		expect(
			deriveUnitProgressState({
				...authenticatedSource,
				recordError: progressNotFound,
				recordFailed: true,
				recordMissing: true,
			}),
		).toEqual({ kind: "untracked" });
	});

	it("preserves non-missing query failures as errors", () => {
		const failure = new Error("Network failure");

		expect(
			deriveUnitProgressState({
				...authenticatedSource,
				recordError: failure,
				recordFailed: true,
			}),
		).toEqual({ kind: "error", error: failure });
	});
});
