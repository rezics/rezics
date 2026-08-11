import { describe, expect, it } from "vitest";

import {
	hasAuthoredAnnotation,
	realmGovernanceActionRequiresRules,
	toRealmModerationCommand,
	toRealmModerationStatus,
} from "./moderation-contract";

describe("Realm moderation UI contract", () => {
	it("rejects stale select values at the generated contract boundary", () => {
		const allowed = ["hide", "remove", "lock_post_targeting", "note"] as const;
		expect(toRealmModerationCommand("approve", allowed)).toBe("hide");
		expect(toRealmModerationStatus("not_a_status")).toBe("all");
	});

	it("requires one or more rule references only for adverse content actions", () => {
		expect(realmGovernanceActionRequiresRules("hide")).toBe(true);
		expect(realmGovernanceActionRequiresRules("remove")).toBe(true);
		expect(realmGovernanceActionRequiresRules("lock_post_targeting")).toBe(true);
		expect(realmGovernanceActionRequiresRules("approve")).toBe(false);
		expect(realmGovernanceActionRequiresRules("note")).toBe(false);
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
					children: [{ _key: "span-1", _type: "span", text: "Decision context", marks: [] }],
					markDefs: [],
					style: "normal",
				},
			]),
		).toBe(true);
	});
});
