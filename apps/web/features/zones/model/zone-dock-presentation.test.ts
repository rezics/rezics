import type { MenuBlock, UnitRefBlock } from "@rezics/block";
import { describe, expect, it } from "vitest";

import { zoneDockPresentation } from "./zone-dock-presentation";

const NavigationId = "019f9000-0000-7000-8000-000000000001";
const MissingNavigationId = "019f9000-0000-7000-8000-000000000002";
const UnitId = "019f9000-0000-7000-8000-000000000003";

function menu(navigationId: string, key: string): MenuBlock {
	return {
		_type: "menu",
		_key: key,
		appearance: "links",
		navigationId,
		orientation: "horizontal",
	};
}

describe("Zone Dock presentation", () => {
	it("projects valid Menu Blocks into platform navigation and keeps other Blocks in content", () => {
		const validMenu = menu(NavigationId, "000000000001");
		const invalidMenu = menu(MissingNavigationId, "000000000002");
		const content = {
			_type: "unit-ref",
			_key: "000000000003",
			appearance: "card",
			unitId: UnitId,
		} satisfies UnitRefBlock;

		const presentation = zoneDockPresentation(
			[validMenu, content, invalidMenu],
			[{ id: NavigationId }],
		);

		expect(presentation.menuBlocks).toEqual([validMenu]);
		expect(presentation.contentBlocks).toEqual([content]);
	});

	it("returns empty regions when the Dock is empty", () => {
		expect(zoneDockPresentation([], [])).toEqual({ contentBlocks: [], menuBlocks: [] });
	});
});
