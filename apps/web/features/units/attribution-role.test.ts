import { describe, expect, it } from "vitest";

import {
	CreditAttributionRolesByUnitType,
	findPrimaryBookAuthor,
	groupByAssociationRole,
} from "./attribution-role";

describe("attribution role model", () => {
	it("keeps the restored role registry scoped to each catalog Unit type", () => {
		expect(CreditAttributionRolesByUnitType.book).toContain("author");
		expect(CreditAttributionRolesByUnitType.book).toContain("translator");
		expect(CreditAttributionRolesByUnitType.software).toContain("developer");
		expect(CreditAttributionRolesByUnitType.media).toContain("director");
		expect(CreditAttributionRolesByUnitType.media).not.toContain("author");
	});

	it("groups by role without losing the API position order", () => {
		const grouped = groupByAssociationRole([
			{ id: "first-author", role: "author" as const },
			{ id: "translator", role: "translator" as const },
			{ id: "second-author", role: "author" as const },
		]);

		expect(grouped).toEqual([
			{
				role: "author",
				items: [
					{ id: "first-author", role: "author" },
					{ id: "second-author", role: "author" },
				],
			},
			{
				role: "translator",
				items: [{ id: "translator", role: "translator" }],
			},
		]);
	});

	it("selects the first author from the position-ordered API result", () => {
		expect(
			findPrimaryBookAuthor([
				{ id: "publisher-first", role: "publisher" },
				{ id: "author-first", role: "author" },
				{ id: "author-second", role: "author" },
			]),
		).toEqual({ id: "author-first", role: "author" });
	});
});
