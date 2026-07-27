import { describe, expect, it } from "vitest";

import { RealmRuleRevisionChanged } from "./errors";
import { requireCurrentRealmRuleRevision } from "./rule-acknowledgement";

describe("Realm rule acknowledgement", () => {
	it("returns the requested revision only while it remains current", () => {
		const revisionId = "019f995d-7595-7c99-9183-250790bbfe2f";

		expect(requireCurrentRealmRuleRevision(revisionId, revisionId)).toBe(revisionId);
	});

	it.each([
		["019f995d-7595-7c99-9183-250790bbfe30", "019f995d-7595-7c99-9183-250790bbfe31"],
		["019f995d-7595-7c99-9183-250790bbfe30", undefined],
	] as const)("rejects stale and missing current revisions", (requested, current) => {
		expect(() => requireCurrentRealmRuleRevision(requested, current)).toThrow(
			RealmRuleRevisionChanged,
		);
		try {
			requireCurrentRealmRuleRevision(requested, current);
		} catch (error) {
			expect(error).toMatchObject({
				details: { currentRevisionId: current ?? null },
			});
		}
	});
});
