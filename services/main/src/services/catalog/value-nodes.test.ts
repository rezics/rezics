import { describe, expect, it } from "vitest";
import { CatalogPartialDateSchema } from "./contracts";
import { CatalogValueNodeSchema, catalogValueNodes } from "./value-nodes";

describe("native catalog values", () => {
	it("preserves ordered repeated Infobox entries, null, false and fractional values", () => {
		const nodes = [
			...catalogValueNodes([
				{ key: "alias", value: "one" },
				{ key: "alias", value: [null, false, 1.5] },
			]),
		];
		expect(nodes.filter((node) => node.memberKey === "key").map((node) => node.textValue)).toEqual([
			"alias",
			"alias",
		]);
		expect(nodes.filter((node) => node.kind === "number").map((node) => node.numberValue)).toEqual([
			"1.5",
		]);
		expect(nodes.some((node) => node.kind === "boolean" && node.booleanValue === false)).toBe(true);
		expect(nodes.filter((node) => node.kind === "null")).toHaveLength(1);
		expect(nodes.every((node) => CatalogValueNodeSchema.safeParse(node).success)).toBe(true);
	});
	it("rejects cycles and non-JSON values instead of dropping them", () => {
		const cycle: unknown[] = [];
		cycle.push(cycle);
		expect(() => [...catalogValueNodes(cycle)]).toThrow("acyclic");
		expect(() => [...catalogValueNodes({ value: undefined })]).toThrow("JSON");
		expect(() => [...catalogValueNodes(Number.NaN)]).toThrow("finite");
		expect(() => [...catalogValueNodes(new Date())]).toThrow("plain JSON");
	});
	it("rejects scalar-column mismatches and absent non-root parent kinds", () => {
		const base = {
			position: 1,
			parentPosition: 0,
			parentKind: null,
			memberKey: null,
			kind: "number",
			numberValue: "2",
			textValue: null,
			booleanValue: null,
		};
		expect(CatalogValueNodeSchema.safeParse(base).success).toBe(false);
		expect(
			CatalogValueNodeSchema.safeParse({ ...base, parentKind: "array", textValue: "2" }).success,
		).toBe(false);
	});
	it("allows incomplete dates without inventing precision and checks known calendar days", () => {
		expect(CatalogPartialDateSchema.parse({ year: null, month: 2, day: 29 })).toEqual({
			year: null,
			month: 2,
			day: 29,
		});
		expect(CatalogPartialDateSchema.safeParse({ year: 1900, month: 2, day: 29 }).success).toBe(
			false,
		);
		expect(CatalogPartialDateSchema.safeParse({ year: 2000, month: 2, day: 29 }).success).toBe(
			true,
		);
		expect(CatalogPartialDateSchema.safeParse({ year: 2026, month: 4, day: 31 }).success).toBe(
			false,
		);
	});
});
