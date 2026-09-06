import { describe, expect, it } from "vitest";
import { sourceValueFromNodes } from "./source-export";
import { catalogValueNodes } from "./value-nodes";

describe("native source value reconstruction", () => {
	it("preserves nested order, false, null, fractions and repeated wiki keys", () => {
		const original = [
			{ key: "edition", value: [{ k: "name", v: "one" }] },
			{ key: "edition", value: [false, null, 1.5] },
		];
		expect(sourceValueFromNodes([...catalogValueNodes(original)])).toEqual(original);
	});
	it("treats prototype-like source keys as ordinary data", () => {
		const original = JSON.parse('{"__proto__":{"polluted":true},"constructor":"name"}');
		const restored = sourceValueFromNodes([...catalogValueNodes(original)]);
		expect(JSON.stringify(restored)).toBe(JSON.stringify(original));
		expect(Object.hasOwn({}, "polluted")).toBe(false);
	});
	it("rejects an incomplete parent path rather than dropping a value", () => {
		const nodes = [...catalogValueNodes({ list: [1, 2] })];
		expect(() => sourceValueFromNodes(nodes.filter((node) => node.position !== 1))).toThrow(
			"parent",
		);
	});
});
