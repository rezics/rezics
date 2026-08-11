import { describe, expect, it } from "vitest";

import type { ContributionResourceListQuery } from "../api/history/schema";
import { InvalidPaginationCursor } from "../pagination/errors";
import { decodeParticipationCursor, encodeParticipationCursor } from "./participation-cursor";

const ResourceUnitId = "019b76da-a800-7300-8000-000000000002";

describe("participation cursor", () => {
	it("round-trips an ordered History boundary", () => {
		const query = {
			section: "wiki",
			kind: "contributed",
			localizationLanguages: ["zh", "en"],
		} satisfies ContributionResourceListQuery;
		const boundary = {
			sortAt: new Date("2026-07-27T08:00:00.000Z"),
			resourceUnitId: ResourceUnitId,
		};
		const cursor = encodeParticipationCursor(query, boundary);
		expect(decodeParticipationCursor(cursor, query)).toEqual(boundary);
	});

	it("cannot be reused for a different participation kind", () => {
		const query = { section: "book", kind: "created" } as const;
		const cursor = encodeParticipationCursor(query, {
			sortAt: new Date("2026-07-27T08:00:00.000Z"),
			resourceUnitId: ResourceUnitId,
		});
		expect(() => decodeParticipationCursor(cursor, { ...query, kind: "contributed" })).toThrow(
			InvalidPaginationCursor,
		);
	});
});
