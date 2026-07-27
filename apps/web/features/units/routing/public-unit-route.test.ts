import { describe, expect, it } from "vitest";

import { publicUnitHref } from "./public-unit-route";

describe("publicUnitHref", () => {
	it("routes a Tag path returned through the mixed Search Feed", () => {
		expect(publicUnitHref("structure", { id: "structure-id" })).toBe(
			"/tag-structures/structure-id",
		);
	});
});
