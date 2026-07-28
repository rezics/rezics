import { describe, expect, it } from "vitest";
import { TopLevelSlugNamespaceUnitIds } from "@rezics/slug";

import { ProfileSlugChangeUnavailable, SlugReserved } from "./errors";
import { decideProfileSlugAssignment, parseAssignableProfileSlug } from "./profile-slug-policy";

describe("temporary Profile slug governance", () => {
	it("rejects reserved labels after proving the storage format", () => {
		expect(() => parseAssignableProfileSlug("admin")).toThrow(SlugReserved);
		expect(parseAssignableProfileSlug("alice-example")).toBe("alice-example");
	});

	it("allows the first assignment and an idempotent repeat", () => {
		const slug = parseAssignableProfileSlug("alice");
		expect(decideProfileSlugAssignment(null, slug)).toBe("assign");
		expect(
			decideProfileSlugAssignment(
				{
					scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
					slug,
				},
				slug,
			),
		).toBe("unchanged");
	});

	it("rejects a rename or a mismatched namespace", () => {
		const current = parseAssignableProfileSlug("alice");
		expect(() =>
			decideProfileSlugAssignment(
				{
					scopeUnitId: TopLevelSlugNamespaceUnitIds.users,
					slug: current,
				},
				parseAssignableProfileSlug("bob"),
			),
		).toThrow(ProfileSlugChangeUnavailable);
		expect(() =>
			decideProfileSlugAssignment({ scopeUnitId: null, slug: current }, current),
		).toThrow(ProfileSlugChangeUnavailable);
	});
});
