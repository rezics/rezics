import { describe, expect, it } from "vitest";

import { publicUnitHref } from "./public-unit-route";

describe("publicUnitHref", () => {
	it("routes a Tag returned through the mixed Search Feed", () => {
		expect(publicUnitHref("tag", { id: "tag-id" })).toBe("/tags/tag-id");
	});

	it("routes a Tag structure returned through the mixed Search Feed", () => {
		expect(publicUnitHref("structure", { id: "structure-id" })).toBe(
			"/tag-structures/structure-id",
		);
	});

	it.each(["video", "audio", "release"])("routes top-level manageable Units", (kind) => {
		expect(publicUnitHref(kind, { id: "manageable-unit-id" })).toBe(
			`/units/${kind}/manageable-unit-id`,
		);
	});
});
