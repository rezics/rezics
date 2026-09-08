import { describe, it, expect } from "vitest";
import { creditRolesForReference } from "./credit-role-contract";
describe("native manual credit roles", () => {
	it("distinguishes a written Work from a publication and a software work from a release", () => {
		expect(creditRolesForReference({ owner: "publishing", shape: "work" })).toContain("author");
		expect(creditRolesForReference({ owner: "publishing", shape: "publication" })).not.toContain(
			"author",
		);
		expect(creditRolesForReference({ owner: "software", shape: "release" })).toContain(
			"distributor",
		);
		expect(creditRolesForReference({ owner: "software", shape: "content" })).not.toContain(
			"distributor",
		);
	});
	it("keeps musical work roles distinct from recording performance and rejects mismatched owner shapes", () => {
		expect(creditRolesForReference({ owner: "music", shape: "work" })).not.toContain("actor");
		expect(creditRolesForReference({ owner: "music", shape: "recording" })).toContain("actor");
		expect(creditRolesForReference({ owner: "software", shape: "episode" })).toEqual([]);
		expect(creditRolesForReference({ owner: "program", shape: "episode" })).toContain("director");
	});
});
