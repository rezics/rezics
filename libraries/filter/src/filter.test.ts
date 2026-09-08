import { describe, expect, it } from "vitest";

import { combineUnitPredicates } from "./filter";

describe("combineUnitPredicates", () => {
	it("does not duplicate an equal Zone predicate composed through two trusted paths", () => {
		const predicate = { owner: { in: ["zone" as const] } };
		expect(combineUnitPredicates([predicate, structuredClone(predicate)])).toEqual(predicate);
	});

	it("intersects distinct predicates", () => {
		const kind = { owner: { in: ["publishing" as const] }, shape: { in: ["text_version"] } };
		const language = { localizations: { some: { language: { in: ["en" as const] } } } };
		expect(combineUnitPredicates([kind, language])).toEqual({ all: [kind, language] });
	});
});
