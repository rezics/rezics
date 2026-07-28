import { describe, expect, it } from "vitest";

import { selectReportRealmId, selectReportRuleId } from "./report-selection";

const destinations = [{ id: "rezics-rule" }, { id: "context-realm" }] as const;

describe("Report Select defaults", () => {
	it("defaults to the first global destination without Realm context", () => {
		expect(selectReportRealmId(destinations, undefined, "")).toBe("rezics-rule");
	});

	it("defaults to the context Realm without changing option order", () => {
		expect(selectReportRealmId(destinations, "context-realm", "")).toBe("context-realm");
		expect(destinations[0]?.id).toBe("rezics-rule");
	});

	it("keeps a valid explicit selection and rejects a stale one", () => {
		expect(selectReportRealmId(destinations, "context-realm", "rezics-rule")).toBe(
			"rezics-rule",
		);
		expect(selectReportRealmId(destinations, "context-realm", "removed-realm")).toBe(
			"context-realm",
		);
	});

	it("represents rule choice as one selected item", () => {
		const rules = [{ id: "rule-1" }, { id: "rule-2" }] as const;
		expect(selectReportRuleId(rules, "")).toBe("rule-1");
		expect(selectReportRuleId(rules, "rule-2")).toBe("rule-2");
		expect(selectReportRuleId(rules, "old-rule")).toBe("rule-1");
	});
});
