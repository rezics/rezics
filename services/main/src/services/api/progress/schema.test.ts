import { Check } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";

import { ProgressEntryResponse } from "../schema/response";
import {
	CompleteProgressBody,
	CreateProgressEntryBody,
	ListProgressEntriesQuery,
	ProgressLookupResponse,
	ReplaceProgressEntryBody,
	UpsertProgressBody,
} from "./schema";

describe("progress API contract", () => {
	it("represents untracked and tracked progress as distinct successful states", () => {
		const progress = {
			profileId: "00000000-0000-7000-8000-000000000001",
			unitId: "00000000-0000-7000-8000-000000000002",
			status: "active",
			progress: 0.4,
			isDeleted: false,
			completedCount: 1,
			totalTimeMs: 3_600_000,
			firstSeenAt: "2026-07-26T00:00:00.000Z",
			lastSeenAt: "2026-07-26T01:00:00.000Z",
			lastContentStructureNodeId: null,
			currentEntryId: null,
			lastReadAnchor: null,
			visibility: "private",
			createdAt: "2026-07-26T00:00:00.000Z",
			updatedAt: "2026-07-26T01:00:00.000Z",
		};

		expect(Check(ProgressLookupResponse, { state: "untracked" })).toBe(true);
		expect(
			Check(ProgressLookupResponse, {
				state: "tracked",
				record: progress,
				continuation: {
					kind: "contents",
					ownerUnit: { id: progress.unitId, type: "book" },
				},
			}),
		).toBe(true);
		expect(Check(ProgressLookupResponse, { state: "tracked" })).toBe(false);
		expect(Check(ProgressLookupResponse, { state: "untracked", record: progress })).toBe(false);
	});

	it("keeps completion count outside ordinary progress updates", () => {
		expect(
			Check(UpsertProgressBody, {
				status: "active",
				progress: 0.4,
				lastContentStructureNodeId: null,
			}),
		).toBe(true);
		expect(
			Check(UpsertProgressBody, {
				status: "completed",
				progress: 1,
				completedCount: 3,
			}),
		).toBe(false);
	});

	it("accepts typed journal status filters", () => {
		expect(Check(ListProgressEntriesQuery, {})).toBe(true);
		expect(Check(ListProgressEntriesQuery, { status: "active" })).toBe(true);
		expect(Check(ListProgressEntriesQuery, { status: "completed" })).toBe(true);
		expect(Check(ListProgressEntriesQuery, { status: "all" })).toBe(false);
	});

	it("allows completion to retain an updated cumulative time", () => {
		expect(Check(CompleteProgressBody, {})).toBe(true);
		expect(Check(CompleteProgressBody, { totalTimeMs: 3_600_000 })).toBe(true);
		expect(Check(CompleteProgressBody, { visibility: "public" })).toBe(true);
		expect(Check(CompleteProgressBody, { visibility: "followers" })).toBe(false);
		expect(Check(CompleteProgressBody, { totalTimeMs: -1 })).toBe(false);
		expect(Check(CompleteProgressBody, { totalTimeMs: Number.MAX_SAFE_INTEGER + 1 })).toBe(false);
	});

	it("keeps current-snapshot selection and record provenance out of journal writes", () => {
		const event = {
			entryKind: "update",
			status: "active",
			progress: 0.4,
			occurredAt: "2026-07-26T00:00:00.000Z",
			datePrecision: "instant",
		};
		expect(Check(CreateProgressEntryBody, event)).toBe(true);
		expect(Check(ReplaceProgressEntryBody, event)).toBe(true);
		expect(Check(CreateProgressEntryBody, { ...event, affectsCurrent: true })).toBe(false);
		expect(Check(ReplaceProgressEntryBody, { ...event, affectsCurrent: true })).toBe(false);
		expect(Check(CreateProgressEntryBody, { ...event, sourceKind: "manual" })).toBe(false);
		expect(
			Check(ReplaceProgressEntryBody, {
				...event,
				sourceProvider: "Previous platform",
			}),
		).toBe(false);
	});

	it("keeps current-snapshot eligibility out of journal responses", () => {
		const event = {
			id: "00000000-0000-7000-8000-000000000001",
			profileId: "00000000-0000-7000-8000-000000000002",
			unitId: "00000000-0000-7000-8000-000000000003",
			entryKind: "update",
			status: "active",
			progress: 0.4,
			completionDelta: 0,
			totalTimeMs: 3_600_000,
			lastContentStructureNodeId: null,
			contentStructureRevisionId: null,
			occurredAt: "2026-07-26T00:00:00.000Z",
			datePrecision: "instant",
			reviewId: null,
			createdAt: "2026-07-26T00:00:00.000Z",
			updatedAt: "2026-07-26T00:00:00.000Z",
		};

		expect(Check(ProgressEntryResponse, event)).toBe(true);
		expect(ProgressEntryResponse.properties).not.toHaveProperty("affectsCurrent");
	});
});
