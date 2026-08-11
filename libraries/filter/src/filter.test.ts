import { describe, expect, it } from "vitest";

import { combineUnitPredicates } from "./filter";

describe("combineUnitPredicates", () => {
	it("does not duplicate an equal Zone predicate composed through two trusted paths", () => {
		const predicate = { kind: { in: ["zone" as const] } };
		expect(combineUnitPredicates([predicate, structuredClone(predicate)])).toEqual(predicate);
	});

	it("intersects distinct predicates", () => {
		const kind = { kind: { in: ["book" as const] } };
		const language = { localizations: { some: { language: { in: ["en" as const] } } } };
		expect(combineUnitPredicates([kind, language])).toEqual({ all: [kind, language] });
	});
});
