import { Check } from "typebox/value";
import { describe, expect, it } from "vitest";

import { ReplacePlatformUserAccountStateBody } from "./schema";

const rule = {
	sourceRealmId: "019b76da-a800-7300-8000-000000000001",
	revisionId: "019b76da-a800-7300-8000-000000000002",
	ruleId: "019b76da-a800-7300-8000-000000000003",
};

describe("platform user account-state schema", () => {
	it("requires Rules for every account-state policy decision", () => {
		expect(
			Check(ReplacePlatformUserAccountStateBody, {
				expectedRevision: 1,
				state: "suspended",
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(ReplacePlatformUserAccountStateBody, {
				expectedRevision: 1,
				state: "suspended",
				reason: "security",
			}),
		).toBe(false);
		expect(
			Check(ReplacePlatformUserAccountStateBody, {
				expectedRevision: 2,
				state: "active",
				rules: [rule],
			}),
		).toBe(true);
		expect(
			Check(ReplacePlatformUserAccountStateBody, {
				expectedRevision: 2,
				state: "active",
			}),
		).toBe(false);
	});
});
