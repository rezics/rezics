import { describe, expect, it } from "vitest";

import {
	ContentGovernanceMaximumRuleReferences,
	updateContentRuleSelection,
} from "./content-rule-selection";

describe("content-governance rule selection", () => {
	it("supports independent multi-selection and removal", () => {
		expect(updateContentRuleSelection(["realm:one"], "official:two", true)).toEqual([
			"realm:one",
			"official:two",
		]);
		expect(
			updateContentRuleSelection(["realm:one", "official:two"], "realm:one", false),
		).toEqual(["official:two"]);
	});

	it("does not auto-select or exceed the API rule-reference bound", () => {
		expect(updateContentRuleSelection([], "realm:one", false)).toEqual([]);
		const full = Array.from(
			{ length: ContentGovernanceMaximumRuleReferences },
			(_, index) => `rule:${index}`,
		);
		expect(updateContentRuleSelection(full, "rule:overflow", true)).toEqual(full);
	});
});
