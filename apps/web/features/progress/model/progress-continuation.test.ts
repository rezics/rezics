import { describe, expect, it } from "vitest";

import { parseProgressContinuation, progressContinuationHref } from "./progress-continuation";

describe("progressContinuationHref", () => {
	it("addresses a Book occurrence in its contextual reader", () => {
		expect(
			progressContinuationHref({
				kind: "text-version-node",
				textVersionId: "book-id",
				nodeId: "node-id",
			}),
		).toBe("/catalog/publishing/book-id/read/node-id");
	});

	it("addresses timed Media items directly", () => {
		expect(progressContinuationHref({ kind: "unit", unitId: "video-id", unitType: "video" })).toBe(
			"/units/video/video-id",
		);
	});

	it("falls back to the owner's Contents section", () => {
		expect(
			progressContinuationHref({ kind: "contents", unitId: "media-id", unitType: "program" }),
		).toBe("/catalog/program/media-id/contents");
	});

	it("proves generated union fields before exposing a continuation", () => {
		expect(
			parseProgressContinuation(
				{ kind: "unit", contentUnit: { id: "audio-id", owner: "audio", shape: "audio" } },
				{ type: "program", unitId: "media-id" },
			),
		).toEqual({ kind: "unit", unitId: "audio-id", unitType: "audio" });
		expect(
			parseProgressContinuation(
				{ kind: "unit", contentUnit: { id: "book-id", owner: "publishing", shape: "work" } },
				{ type: "publishing", shape: "text_version", unitId: "book-id" },
			),
		).toEqual({ kind: "contents", unitId: "book-id", unitType: "publishing" });
	});
});
