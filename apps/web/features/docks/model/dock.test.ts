import { describe, expect, it } from "vitest";

import {
	createDockTarget,
	dockAuthorizationScope,
	getDockAddableBlockTypes,
	getSupportedDockKinds,
	partitionDockPresentationIds,
} from "./dock";

describe("Dock frontend contract", () => {
	it.each([
		["realm", ["main", "wiki"]],
		["book", ["main"]],
		["software", ["main"]],
		["media", ["main"]],
		["zone", ["main"]],
		["series", []],
	] as const)("maps %s to its supported Dock kinds", (ownerKind, expected) => {
		expect(getSupportedDockKinds(ownerKind)).toEqual(expected);
	});

	it("constructs only supported owner and kind pairs", () => {
		expect(createDockTarget("realm", "wiki")).toEqual({
			ownerKind: "realm",
			dockKind: "wiki",
		});
		expect(createDockTarget("book", "main")).toEqual({
			ownerKind: "book",
			dockKind: "main",
		});
		expect(createDockTarget("book", "wiki")).toBeUndefined();
		expect(createDockTarget("series", "main")).toBeUndefined();
	});

	it("uses the backend Dock authorization scope", () => {
		expect(dockAuthorizationScope("main")).toEqual(["dock", "main"]);
		expect(dockAuthorizationScope("wiki")).toEqual(["dock", "wiki"]);
	});

	it("partitions presentation lookups at the API request limit", () => {
		const ids = Array.from({ length: 205 }, (_, index) => `unit-${index}`);
		const batches = partitionDockPresentationIds(ids);

		expect(batches).toHaveLength(3);
		expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
		expect(batches.flat()).toEqual(ids);
	});

	it("offers only blocks supported by each frontend Dock host", () => {
		expect(getDockAddableBlockTypes({ ownerKind: "realm", dockKind: "main" })).toEqual([
			"realm-ref",
			"zone-ref",
			"menu",
			"divider",
		]);
		expect(getDockAddableBlockTypes({ ownerKind: "book", dockKind: "main" })).toEqual([
			"realm-ref",
			"zone-ref",
			"divider",
		]);
		expect(getDockAddableBlockTypes({ ownerKind: "zone", dockKind: "main" })).not.toContain(
			"post-full-view",
		);
	});
});
