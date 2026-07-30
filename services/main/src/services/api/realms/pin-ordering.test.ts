import { describe, expect, it } from "vitest";

import { compareFractionalPositions, fractionalPositionAt } from "../../ordering/position";
import { planRealmPinMove, type OrderedRealmPin } from "./pin-ordering";

const pins = [
	{ unitId: "pinned-a", kind: "pinned", position: fractionalPositionAt(0) },
	{ unitId: "pinned-b", kind: "pinned", position: fractionalPositionAt(1) },
	{ unitId: "pinned-c", kind: "pinned", position: fractionalPositionAt(2) },
	{ unitId: "highlight-a", kind: "highlight", position: fractionalPositionAt(0) },
	{ unitId: "highlight-b", kind: "highlight", position: fractionalPositionAt(1) },
] satisfies readonly OrderedRealmPin[];

function orderedUnitIds(
	kind: OrderedRealmPin["kind"],
	planned: ReturnType<typeof planRealmPinMove>,
) {
	if (!planned.ok) throw new Error(planned.message);
	const movedIds = new Set(planned.positions.map(({ unitId }) => unitId));
	return [
		...pins.filter((pin) => pin.kind === kind && !movedIds.has(pin.unitId)),
		...planned.positions.filter((pin) => pin.kind === kind),
	]
		.toSorted((left, right) => compareFractionalPositions(left.position, right.position))
		.map(({ unitId }) => unitId);
}

describe("Realm pin ordering", () => {
	it("moves selected pins to the start while preserving their relative order", () => {
		const planned = planRealmPinMove(pins, {
			unitIds: ["pinned-b", "pinned-c"],
			destinationKind: "pinned",
			placement: { kind: "start" },
		});

		expect(orderedUnitIds("pinned", planned)).toEqual(["pinned-b", "pinned-c", "pinned-a"]);
	});

	it("moves pins between categories after a destination pin", () => {
		const planned = planRealmPinMove(pins, {
			unitIds: ["pinned-b", "pinned-c"],
			destinationKind: "highlight",
			placement: { kind: "after", unitId: "highlight-a" },
		});

		expect(orderedUnitIds("highlight", planned)).toEqual([
			"highlight-a",
			"pinned-b",
			"pinned-c",
			"highlight-b",
		]);
	});

	it("rejects a selection that crosses source categories", () => {
		expect(
			planRealmPinMove(pins, {
				unitIds: ["pinned-a", "highlight-a"],
				destinationKind: "pinned",
				placement: { kind: "end" },
			}),
		).toEqual({
			ok: false,
			field: "unitIds",
			message: "moved Realm pins must come from one category",
		});
	});

	it("rejects an after anchor outside the destination category", () => {
		expect(
			planRealmPinMove(pins, {
				unitIds: ["pinned-a"],
				destinationKind: "highlight",
				placement: { kind: "after", unitId: "pinned-b" },
			}),
		).toEqual({
			ok: false,
			field: "placement",
			message: "the destination must be an unselected pin in the destination category",
		});
	});
});
