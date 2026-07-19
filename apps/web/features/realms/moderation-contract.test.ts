import { describe, expect, it } from "vitest";

import {
	getRealmModerationCommands,
	hasAuthoredAnnotation,
	toGovernanceReasonCode,
	toRealmModerationCommand,
	toRealmModerationStatus,
} from "./moderation-contract";

describe("Realm moderation UI contract", () => {
	it.each([
		["pending", false, ["approve", "remove", "lock", "note"]],
		["visible", true, ["hide", "remove", "unlock", "note"]],
		["hidden", false, ["restore", "remove", "lock", "note"]],
		["removed", true, ["restore", "unlock", "note"]],
	] as const)("derives valid commands for %s", (status, locked, expected) => {
		expect(getRealmModerationCommands(status, locked)).toEqual(expected);
	});

	it("rejects stale select values at the generated contract boundary", () => {
		const allowed = getRealmModerationCommands("visible", false);
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
