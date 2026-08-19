import { describe, expect, it } from "vitest";

import { parseProgressContinuation, progressContinuationHref } from "./progress-continuation";

describe("progressContinuationHref", () => {
	it("addresses a Book occurrence in its contextual reader", () => {
		expect(
			progressContinuationHref({ kind: "book-node", bookId: "book-id", nodeId: "node-id" }),
		).toBe("/units/book/book-id/read/node-id");
	});

	it("addresses timed Media items directly", () => {
		expect(progressContinuationHref({ kind: "unit", unitId: "video-id", unitType: "video" })).toBe(
			"/units/video/video-id",
		);
	});

	it("falls back to the owner's Contents section", () => {
		expect(
			progressContinuationHref({ kind: "contents", unitId: "media-id", unitType: "media" }),
		).toBe("/units/media/media-id/contents");
	});

	it("proves generated union fields before exposing a continuation", () => {
		expect(
			parseProgressContinuation(
				{ kind: "unit", contentUnit: { id: "audio-id", type: "audio" } },
				{ type: "media", unitId: "media-id" },
			),
		).toEqual({ kind: "unit", unitId: "audio-id", unitType: "audio" });
		expect(
			parseProgressContinuation(
				{ kind: "unit", contentUnit: { id: "book-id", type: "book" } },
				{ type: "book", unitId: "book-id" },
			),
		).toEqual({ kind: "contents", unitId: "book-id", unitType: "book" });
	});
});
