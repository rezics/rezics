import { describe, expect, it } from "vitest";

import {
	hasAuthoredAnnotation,
	toGovernanceReasonCode,
	toRealmModerationCommand,
	toRealmModerationStatus,
} from "./moderation-contract";

describe("Realm moderation UI contract", () => {
	it("rejects stale select values at the generated contract boundary", () => {
		const allowed = ["hide", "remove", "lock_post_targeting", "note"] as const;
		expect(toRealmModerationCommand("approve", allowed)).toBe("hide");
		expect(toGovernanceReasonCode("not_a_reason")).toBe("other");
		expect(toRealmModerationStatus("not_a_status")).toBe("all");
	});

	it("requires authored text or an image before creating an annotation Post", () => {
		expect(hasAuthoredAnnotation([])).toBe(false);
		expect(
			hasAuthoredAnnotation([
				{
					_key: "block-1",
					_type: "block",
					children: [{ _key: "span-1", _type: "span", text: "  ", marks: [] }],
					markDefs: [],
					style: "normal",
				},
			]),
		).toBe(false);
		expect(
			hasAuthoredAnnotation([
				{
					_key: "block-1",
					_type: "block",
					children: [
						{ _key: "span-1", _type: "span", text: "Decision context", marks: [] },
					],
					markDefs: [],
					style: "normal",
				},
			]),
		).toBe(true);
	});
});
