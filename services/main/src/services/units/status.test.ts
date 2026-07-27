import { describe, expect, it } from "vitest";

import { changesUnitStatus } from "./status";

describe("Unit status changes", () => {
	it.each([
		["draft", "published"],
		["draft", "archived"],
		["archived", "draft"],
		["published", "archived"],
		["published", "draft"],
	] as const)("requires status-update permission for %s -> %s", (fromStatus, toStatus) => {
		expect(changesUnitStatus(fromStatus, toStatus)).toBe(true);
	});

	it.each([
		["draft", "draft"],
		["archived", "archived"],
		["published", "published"],
	] as const)(
		"does not require status-update permission for %s -> %s",
		(fromStatus, toStatus) => {
			expect(changesUnitStatus(fromStatus, toStatus)).toBe(false);
		},
	);
});
