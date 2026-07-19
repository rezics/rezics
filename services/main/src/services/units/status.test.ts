import { describe, expect, it } from "vitest";

import { crossesPublishedBoundary } from "./status";

describe("Unit status publication boundary", () => {
	it.each([
		["draft", "published"],
		["published", "archived"],
		["published", "draft"],
	] as const)("requires publish permission for %s -> %s", (fromStatus, toStatus) => {
		expect(crossesPublishedBoundary(fromStatus, toStatus)).toBe(true);
	});

	it.each([
		["draft", "draft"],
		["draft", "archived"],
		["archived", "draft"],
		["published", "published"],
	] as const)("does not require publish permission for %s -> %s", (fromStatus, toStatus) => {
		expect(crossesPublishedBoundary(fromStatus, toStatus)).toBe(false);
	});
});
