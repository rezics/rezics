import { describe, expect, it } from "vitest";

import {
	GovernanceMaximumRuleReferences,
	governanceRuleSelectionKey,
	getAvailableGovernanceRuleKeys,
	getGovernanceRuleSource,
	getGovernanceRuleReferences,
	getGovernanceRuleKeys,
	retainAvailableGovernanceRuleSelection,
	updateGovernanceRuleSelection,
} from "./governance-rule-selection";

const sources = [
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

describe("governance Rule selection", () => {
	it("builds stable source-aware keys and references", () => {
		const realmKey = governanceRuleSelectionKey("realm-one", "realm-revision", "realm-rule-one");
		const officialKey = governanceRuleSelectionKey(
			"official",
			"official-revision",
			"official-rule-one",
		);

		expect(getGovernanceRuleKeys(sources[0])).toEqual([
			realmKey,
			governanceRuleSelectionKey("realm-one", "realm-revision", "realm-rule-two"),
		]);
		expect(getAvailableGovernanceRuleKeys(sources)).toEqual([
			realmKey,
			governanceRuleSelectionKey("realm-one", "realm-revision", "realm-rule-two"),
			officialKey,
		]);
		expect(getGovernanceRuleReferences(sources, [officialKey, realmKey])).toEqual([
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

	it("prefers the local Realm, then the current Realm, and honors an explicit source", () => {
		const local = {
			id: "zone-local",
			scope: "local",
			language: "en",
			title: "Zone Rule Realm",
			revisionId: "zone-local-revision",
			rules: [{ id: "zone-local-rule", language: "en", title: "Zone local rule" }],
		} as const;

		expect(getGovernanceRuleSource([sources[0], local, sources[1]])?.id).toBe("zone-local");
		expect(getGovernanceRuleSource(sources)?.id).toBe("realm-one");
		expect(getGovernanceRuleSource(sources, "official")?.id).toBe("official");
		expect(getGovernanceRuleSource(sources, "missing")?.id).toBe("realm-one");
		expect(getGovernanceRuleSource([])).toBeUndefined();
	});

	it("supports independent multi-selection and removal", () => {
		expect(updateGovernanceRuleSelection(["realm:one"], "official:two", true)).toEqual([
			"realm:one",
			"official:two",
		]);
		expect(
			updateGovernanceRuleSelection(["realm:one", "official:two"], "realm:one", false),
		).toEqual(["official:two"]);
	});

	it("does not auto-select or exceed the API rule-reference bound", () => {
		expect(updateGovernanceRuleSelection([], "realm:one", false)).toEqual([]);
		const full = Array.from(
			{ length: GovernanceMaximumRuleReferences },
			(_, index) => `rule:${index}`,
		);
		expect(updateGovernanceRuleSelection(full, "rule:overflow", true)).toEqual(full);
	});

	it("retains selections from both sources while removing stale and duplicate keys", () => {
		const realmKey = governanceRuleSelectionKey("realm-one", "realm-revision", "realm-rule-one");
		const officialKey = governanceRuleSelectionKey(
			"official",
			"official-revision",
			"official-rule-one",
		);
		expect(
			retainAvailableGovernanceRuleSelection(
				["stale", officialKey, realmKey, officialKey],
				sources,
			),
		).toEqual([officialKey, realmKey]);
	});
});
