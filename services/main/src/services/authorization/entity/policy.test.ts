import { describe, expect, it } from "vitest";

import {
	associationPolicyAllows,
	DefaultEntityAssociationPolicy,
	resolveEntityAssociationPolicy,
} from "./policy";

describe("Entity association policy", () => {
	it("defaults credit and subject relationships independently to open", () => {
		expect(resolveEntityAssociationPolicy([])).toEqual(DefaultEntityAssociationPolicy);
		expect(resolveEntityAssociationPolicy([{ kind: "subject", mode: "closed" }])).toEqual({
			creditAttribution: "open",
			subjectAssociation: "closed",
		});
	});

	it.each([
		["open", "community", true],
		["owner_only", "community", false],
		["owner_only", "owner", true],
		["closed", "owner", false],
		["closed", "platform", true],
	] as const)("resolves %s for %s as %s", (mode, actor, expected) => {
		expect(associationPolicyAllows(mode, actor)).toBe(expected);
	});
});
