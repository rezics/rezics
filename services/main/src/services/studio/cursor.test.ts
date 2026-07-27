import { describe, expect, it } from "vitest";

import type { StudioContentListQuery } from "../api/users/schema";
import { InvalidPaginationCursor } from "../pagination/errors";
import { decodeStudioCursor, encodeStudioCursor } from "./cursor";

const UnitId = "019b76da-a800-7300-8000-000000000002";

describe("Studio cursor", () => {
	it("round-trips its boundary inside the complete filter scope", () => {
		const query = {
			section: "book",
			view: "contributed",
			permission: "unit.update",
			workState: "actionable",
			status: "published",
			visibility: "public",
			sort: "recent",
			localizationLanguages: ["zh", "en"],
		} satisfies StudioContentListQuery;
		const boundary = {
			bucket: true,
			sortAt: new Date("2026-07-27T08:00:00.000Z"),
			unitId: UnitId,
		};
		const cursor = encodeStudioCursor(query, boundary);
		expect(decodeStudioCursor(cursor, query)).toEqual(boundary);
	});

	it("rejects malformed cursors and reuse under another filter", () => {
		const query = { section: "book", view: "created", sort: "recent" } as const;
		const cursor = encodeStudioCursor(query, {
			bucket: false,
			sortAt: new Date("2026-07-27T08:00:00.000Z"),
			unitId: UnitId,
		});
		expect(() => decodeStudioCursor(cursor, { ...query, view: "assigned" })).toThrow(
			InvalidPaginationCursor,
		);
		expect(() => decodeStudioCursor("not-a-cursor", query)).toThrow(InvalidPaginationCursor);
	});
});
