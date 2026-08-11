import { describe, expect, it } from "vitest";

import {
	ContentGovernanceMaximumRuleReferences,
	contentRuleSelectionKey,
	getAvailableContentRuleKeys,
	getContentRuleDestination,
	getContentRuleReferences,
	getContentRuleKeys,
	retainAvailableContentRuleSelection,
	updateContentRuleSelection,
} from "./content-rule-selection";

const destinations = [
	{
		id: "realm-one",
		scope: "realm",
		language: "en",
		title: "Realm One",
		revisionId: "realm-revision",
		rules: [
			{ id: "realm-rule-one", language: "en", title: "Realm rule one" },
			{ id: "realm-rule-two", language: "en", title: "Realm rule two" },
		],
	},
	{
		id: "official",
		scope: "platform",
		language: "en",
		title: "REZICS Rule",
		revisionId: "official-revision",
		rules: [{ id: "official-rule-one", language: "en", title: "Official rule one" }],
	},
] as const;

describe("content-governance rule selection", () => {
	it("builds stable source-aware keys and references", () => {
		const realmKey = contentRuleSelectionKey("realm-one", "realm-revision", "realm-rule-one");
		const officialKey = contentRuleSelectionKey(
			"official",
			"official-revision",
			"official-rule-one",
		);

		expect(getContentRuleKeys(destinations[0])).toEqual([
			realmKey,
			contentRuleSelectionKey("realm-one", "realm-revision", "realm-rule-two"),
		]);
		expect(getAvailableContentRuleKeys(destinations)).toEqual([
			realmKey,
			contentRuleSelectionKey("realm-one", "realm-revision", "realm-rule-two"),
			officialKey,
		]);
		expect(getContentRuleReferences(destinations, [officialKey, realmKey])).toEqual([
			{
				sourceRealmId: "realm-one",
				revisionId: "realm-revision",
				ruleId: "realm-rule-one",
			},
			{
				sourceRealmId: "official",
				revisionId: "official-revision",
				ruleId: "official-rule-one",
			},
		]);
	});

	it("prefers the current Realm and falls back to the first source", () => {
		expect(getContentRuleDestination(destinations)?.id).toBe("realm-one");
		expect(getContentRuleDestination(destinations, "official")?.id).toBe("official");
		expect(getContentRuleDestination(destinations, "missing")?.id).toBe("realm-one");
		expect(getContentRuleDestination([])).toBeUndefined();
	});

	it("supports independent multi-selection and removal", () => {
		expect(updateContentRuleSelection(["realm:one"], "official:two", true)).toEqual([
			"realm:one",
			"official:two",
		]);
		expect(updateContentRuleSelection(["realm:one", "official:two"], "realm:one", false)).toEqual([
			"official:two",
		]);
	});

	it("does not auto-select or exceed the API rule-reference bound", () => {
		expect(updateContentRuleSelection([], "realm:one", false)).toEqual([]);
		const full = Array.from(
			{ length: ContentGovernanceMaximumRuleReferences },
			(_, index) => `rule:${index}`,
		);
		expect(updateContentRuleSelection(full, "rule:overflow", true)).toEqual(full);
	});

	it("retains selections from both sources while removing stale and duplicate keys", () => {
		const realmKey = contentRuleSelectionKey("realm-one", "realm-revision", "realm-rule-one");
		const officialKey = contentRuleSelectionKey(
			"official",
			"official-revision",
			"official-rule-one",
		);
		expect(
			retainAvailableContentRuleSelection(
				["stale", officialKey, realmKey, officialKey],
				destinations,
			),
		).toEqual([officialKey, realmKey]);
	});
});
