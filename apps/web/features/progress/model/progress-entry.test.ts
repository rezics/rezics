import { describe, expect, it } from "vitest";

import { createProgressEntryDraft, createProgressEntryWrite } from "./progress-entry";

describe("progress entry draft", () => {
	it("normalizes a completion into a completed, 100% event", () => {
		const draft = createProgressEntryDraft(undefined, new Date("2026-07-28T12:00:00Z"));
		expect(
			createProgressEntryWrite({
				...draft,
				entryKind: "completion",
				percentage: "17",
				status: "paused",
			}),
		).toMatchObject({
			entryKind: "completion",
			progress: 1,
			status: "completed",
		});
	});

	it("keeps unknown dates explicitly null", () => {
		const draft = createProgressEntryDraft(undefined);
		const write = createProgressEntryWrite({
			...draft,
			datePrecision: "unknown",
			dateValue: "",
		});

		expect(write).toMatchObject({ occurredAt: null });
		expect(write).not.toHaveProperty("affectsCurrent");
	});

	it("rejects invalid progress values", () => {
		const draft = createProgressEntryDraft(undefined);
		expect(createProgressEntryWrite({ ...draft, percentage: "101" })).toBeUndefined();
	});
});
