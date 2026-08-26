import { describe, expect, it } from "vitest";

import type { DockDocument, UnitReferencedBlock, UnitReferencedBlockDocument } from "./blocks";
import { encodeBlockPath, resolveBlockPath } from "./block-path";
import { MaxZoneEagerBlockExecutions, createZoneBlockExecutionPlan } from "./execution-plan";
import { ZonePageBlockHostPolicy, assertUnitReferencedBlockDocument } from "./validation";

const UnitA = "019b0000-0000-7000-8000-000000000001";
const UnitB = "019b0000-0000-7000-8000-000000000002";

type UnitReference = Extract<UnitReferencedBlock, { readonly _type: "unit-ref" }>;
type Feed = Extract<UnitReferencedBlock, { readonly _type: "feed" }>;

function unitReference(key: string, unitId: string): UnitReference {
	return { _type: "unit-ref", _key: key, unitId, appearance: "card" };
}

function feed(key: string): Feed {
	return {
		_type: "feed",
		_key: key,
		feature: { kind: "global" },
		presentation: { pagination: "load-more", showResultCount: false },
	};
}

function page(blocks: readonly UnitReferencedBlock[]): UnitReferencedBlockDocument {
	return { _type: "block-document", _key: "000000000001", blocks: [...blocks] };
}

function dock(blocks: readonly UnitReferencedBlock[]): DockDocument {
	return { _type: "dock-document", _key: "000000000002", blocks: [...blocks] };
}

describe("BlockPath sibling-local identity", () => {
	it("allows the same Block key in independent sibling scopes and resolves both paths", () => {
		const document = page([
			{
				_type: "group",
				_key: "100000000001",
				layout: "stack",
				blocks: [unitReference("300000000001", UnitA)],
			},
			{
				_type: "group",
				_key: "200000000001",
				layout: "stack",
				blocks: [unitReference("300000000001", UnitB)],
			},
		]);
		const firstPath = [
			{ slot: "blocks", key: "100000000001" },
			{ slot: "blocks", key: "300000000001" },
		] as const;
		const secondPath = [
			{ slot: "blocks", key: "200000000001" },
			{ slot: "blocks", key: "300000000001" },
		] as const;

		expect(() =>
			assertUnitReferencedBlockDocument(document, ZonePageBlockHostPolicy),
		).not.toThrow();
		expect(resolveBlockPath(document, firstPath)).toMatchObject({ unitId: UnitA });
		expect(resolveBlockPath(document, secondPath)).toMatchObject({ unitId: UnitB });
		expect(encodeBlockPath(firstPath)).not.toBe(encodeBlockPath(secondPath));
	});

	it("rejects duplicate keys only inside the same sibling array", () => {
		const document = page([
			unitReference("300000000001", UnitA),
			unitReference("300000000001", UnitB),
		]);

		expect(() => assertUnitReferencedBlockDocument(document, ZonePageBlockHostPolicy)).toThrow(
			"Duplicate Block key 300000000001",
		);
	});

	it("keeps equal Page and Dock paths distinct by runtime surface", () => {
		const plan = createZoneBlockExecutionPlan({
			page: page([feed("400000000001")]),
			dock: dock([feed("400000000001")]),
		});

		expect(plan.eager).toHaveLength(2);
		expect(plan.eager.map(({ surface }) => surface)).toEqual(["page", "dock"]);
		expect(plan.eager[0]?.path).toEqual(plan.eager[1]?.path);
	});
});

describe("Zone eager execution planning", () => {
	it("reserves six Page and two Dock slots under the eight-Block budget", () => {
		const pageFeeds = Array.from({ length: 8 }, (_, index) =>
			feed(`5${index.toString().padStart(11, "0")}`),
		);
		const dockFeeds = Array.from({ length: 4 }, (_, index) =>
			feed(`6${index.toString().padStart(11, "0")}`),
		);
		const plan = createZoneBlockExecutionPlan({
			page: page(pageFeeds),
			dock: dock(dockFeeds),
		});

		expect(plan.eager).toHaveLength(MaxZoneEagerBlockExecutions);
		expect(plan.eager.filter(({ surface }) => surface === "page")).toHaveLength(6);
		expect(plan.eager.filter(({ surface }) => surface === "dock")).toHaveLength(2);
		expect(plan.skipped.every(({ reason }) => reason === "budget")).toBe(true);
	});

	it("borrows unused Page capacity for Dock work", () => {
		const plan = createZoneBlockExecutionPlan({
			page: page([feed("700000000001")]),
			dock: dock([
				feed("800000000001"),
				feed("800000000002"),
				feed("800000000003"),
				feed("800000000004"),
			]),
		});

		expect(plan.eager).toHaveLength(5);
		expect(plan.skipped).toHaveLength(0);
	});

	it("does not automatically execute Blocks in inactive tabs", () => {
		const document = page([
			{
				_type: "tabs",
				_key: "900000000001",
				tabs: [
					{
						_key: "900000000002",
						labelUnitId: UnitA,
						blocks: [feed("900000000004")],
					},
					{
						_key: "900000000003",
						labelUnitId: UnitB,
						blocks: [feed("900000000005")],
					},
				],
			},
		]);
		const plan = createZoneBlockExecutionPlan({ page: document });

		expect(plan.eager.map(({ block }) => block._key)).toEqual(["900000000004"]);
		expect(plan.skipped).toMatchObject([
			{ block: { _key: "900000000005" }, reason: "inactive-tab" },
		]);
	});
});
