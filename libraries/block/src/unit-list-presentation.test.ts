import { describe, expect, it } from "vitest";

import type { UnitListBlock, UnitReferencedBlockDocument } from "./blocks";
import { ZonePageBlockHostPolicy, assertUnitReferencedBlockDocument } from "./validation";

const UnitId = "019b0000-0000-7000-8000-000000000001";

function document(block: UnitListBlock): UnitReferencedBlockDocument {
	return {
		_type: "block-document",
		_key: "000000000001",
		blocks: [block],
	};
}

function unitList(
	layout: UnitListBlock["layout"],
	presentation?: UnitListBlock["presentation"],
): UnitListBlock {
	return {
		_type: "unit-list",
		_key: "000000000002",
		layout,
		limit: 10,
		...(presentation ? { presentation } : {}),
		source: { kind: "units", unitIds: [UnitId] },
	};
}

describe("Unit List item presentation", () => {
	it("accepts the compact identity badge contract", () => {
		expect(() =>
			assertUnitReferencedBlockDocument(
				document(unitList("wrap", { itemAppearance: "identity-badge" })),
				ZonePageBlockHostPolicy,
			),
		).not.toThrow();
	});

	it.each([unitList("wrap"), unitList("carousel", { itemAppearance: "identity-badge" })])(
		"rejects a layout and item appearance mismatch",
		(block) => {
			expect(() =>
				assertUnitReferencedBlockDocument(document(block), ZonePageBlockHostPolicy),
			).toThrow("must pair the wrap layout with the identity-badge appearance");
		},
	);

	it("rejects shelf sizing on identity badges", () => {
		expect(() =>
			assertUnitReferencedBlockDocument(
				document(unitList("wrap", { itemAppearance: "identity-badge", itemSize: "sm" })),
				ZonePageBlockHostPolicy,
			),
		).toThrow("cannot set a shelf item size for identity badges");
	});
});
