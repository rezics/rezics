import { describe, expect, it } from "vitest";

import {
	DefaultEntityAssociationPolicy,
	resolveEntityAssociationPolicy,
	resolveEntityAssociationAdmission,
} from "./policy";

describe("Entity association policy", () => {
	it("defaults credit to approval and subject relationships to open independently", () => {
		expect(resolveEntityAssociationPolicy([])).toEqual(DefaultEntityAssociationPolicy);
		expect(resolveEntityAssociationPolicy([{ kind: "subject", mode: "closed" }])).toEqual({
			creditAttribution: "approval",
			subjectAssociation: "closed",
		});
	});

	it("distinguishes direct admission from two-sided proposal workflows", () => {
		expect(
			resolveEntityAssociationAdmission({
				mode: "open",
				command: "direct",
				targetManager: false,
				platformOverride: false,
			}),
		).toEqual({ kind: "materialize" });
		expect(
			resolveEntityAssociationAdmission({
				mode: "approval",
				command: "request",
				targetManager: false,
				platformOverride: false,
			}),
		).toEqual({ kind: "proposal", awaiting: "target" });
		expect(
			resolveEntityAssociationAdmission({
				mode: "invite_only",
				command: "invitation",
				targetManager: true,
				platformOverride: false,
			}),
		).toEqual({ kind: "proposal", awaiting: "source" });
		expect(
			resolveEntityAssociationAdmission({
				mode: "closed",
				command: "invitation",
				targetManager: true,
				platformOverride: false,
			}),
		).toEqual({ kind: "forbidden" });
	});
});
