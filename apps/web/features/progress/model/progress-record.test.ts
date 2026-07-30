import { describe, expect, it } from "vitest";

import {
	changeProgressDraftStatus,
	completeProgressOptimistically,
	createBacklogUpdate,
	createProgressDraft,
	createProgressUpdate,
	createRereadUpdate,
	createResumeUpdate,
	isCompletionTransition,
	parseBoundedNumber,
	parseNonNegativeInteger,
	toTrackedUnitProgressState,
	toProgressStatus,
	type UnitProgressRecord,
} from "./progress-record";

const activeBook: UnitProgressRecord = {
	completedCount: 2,
	lastContentStructureNodeId: "019f0000-0000-7000-8000-000000000001",
	progress: 0.42,
	status: "active",
	totalTimeMs: 0,
	visibility: "private",
};

describe("progress record input", () => {
	it("narrows server statuses to the supported transition set", () => {
		expect(toProgressStatus("completed")).toBe("completed");
		expect(toProgressStatus("future-status")).toBe("active");
	});

	it("checks percentage bounds", () => {
		expect(parseBoundedNumber("45.5", { minimum: 0, maximum: 100 })).toBe(45.5);
		expect(parseBoundedNumber("-1", { minimum: 0, maximum: 100 })).toBeUndefined();
		expect(parseBoundedNumber("101", { minimum: 0, maximum: 100 })).toBeUndefined();
		expect(parseBoundedNumber("", { minimum: 0, maximum: 100 })).toBeUndefined();
	});

	it("accepts only non-negative safe integer counts", () => {
		expect(parseNonNegativeInteger("3")).toBe(3);
		expect(parseNonNegativeInteger("3.5")).toBeUndefined();
		expect(parseNonNegativeInteger("-1")).toBeUndefined();
	});

	it("creates editable text from a confirmed progress record", () => {
		expect(createProgressDraft(activeBook)).toEqual({
			status: "active",
			percentage: "42",
			totalMinutes: "0",
			lastNodeId: activeBook.lastContentStructureNodeId,
		});
	});

	it("starts a fresh position when leaving a completed record", () => {
		const completed = { ...activeBook, progress: 1, status: "completed" } as const;
		expect(
			changeProgressDraftStatus(createProgressDraft(completed), "active", completed),
		).toEqual({
			status: "active",
			percentage: "0",
			totalMinutes: "0",
			lastNodeId: "",
		});
	});

	it("treats completion as a dedicated transition", () => {
		expect(isCompletionTransition(activeBook, "completed")).toBe(true);
		expect(isCompletionTransition({ ...activeBook, status: "completed" }, "completed")).toBe(
			false,
		);
		expect(completeProgressOptimistically(activeBook)).toEqual({
			...activeBook,
			completedCount: 3,
			lastContentStructureNodeId: null,
			progress: 1,
			status: "completed",
		});
	});

	it("resets transient reading position without changing completion count inputs", () => {
		expect(createBacklogUpdate("book")).toEqual({
			status: "backlog",
			progress: 0,
			lastContentStructureNodeId: null,
		});
		expect(createBacklogUpdate("media")).toEqual({
			status: "backlog",
			progress: 0,
			lastContentStructureNodeId: null,
		});
		expect(createRereadUpdate("book")).toEqual({
			status: "active",
			progress: 0,
			lastContentStructureNodeId: null,
		});
		expect(createRereadUpdate("media")).toEqual({
			status: "active",
			progress: 0,
			lastContentStructureNodeId: null,
		});
		expect(
			createProgressUpdate("book", {
				status: "backlog",
				percentage: "42",
				totalMinutes: "0",
				lastNodeId: activeBook.lastContentStructureNodeId ?? "",
			}),
		).toEqual({
			status: "backlog",
			progress: 0,
			lastContentStructureNodeId: null,
		});
		expect(createResumeUpdate("book", { ...activeBook, status: "paused" })).toEqual({
			status: "active",
			progress: 0.42,
			lastContentStructureNodeId: activeBook.lastContentStructureNodeId,
		});
		expect(
			createResumeUpdate("media", {
				...activeBook,
				status: "paused",
				totalTimeMs: 5_400_000,
			}),
		).toEqual({
			status: "active",
			progress: 0.42,
			lastContentStructureNodeId: activeBook.lastContentStructureNodeId,
			totalTimeMs: 5_400_000,
		});
	});

	it("preserves the proven status when deriving a tracked control state", () => {
		expect(toTrackedUnitProgressState({ ...activeBook, status: "paused" })).toEqual({
			kind: "paused",
			record: { ...activeBook, status: "paused" },
		});
	});

	it("validates domain-specific progress updates", () => {
		expect(
			createProgressUpdate("book", {
				status: "completed",
				percentage: "not-used-at-completion",
				totalMinutes: "0",
				lastNodeId: activeBook.lastContentStructureNodeId ?? "",
			}),
		).toEqual({
			status: "completed",
			progress: 1,
			lastContentStructureNodeId: null,
		});
		expect(
			createProgressUpdate("media", {
				status: "paused",
				percentage: "67",
				totalMinutes: "90",
				lastNodeId: activeBook.lastContentStructureNodeId ?? "",
			}),
		).toEqual({
			status: "paused",
			progress: 0.67,
			lastContentStructureNodeId: activeBook.lastContentStructureNodeId,
			totalTimeMs: 5_400_000,
		});
		expect(
			createProgressUpdate("software", {
				status: "completed",
				percentage: "not-used",
				totalMinutes: "12",
				lastNodeId: "",
			}),
		).toEqual({
			status: "completed",
			progress: 1,
			totalTimeMs: 720_000,
		});
		expect(
			createProgressUpdate("software", {
				status: "active",
				percentage: "not-used",
				totalMinutes: String(Number.MAX_SAFE_INTEGER),
				lastNodeId: "",
			}),
		).toBeUndefined();
	});
});
