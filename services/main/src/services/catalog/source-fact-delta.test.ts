import { describe, it, expect } from "vitest";
import { CatalogSourceFactDescriptorSchema } from "./source-fact-delta";
describe("reviewed source fact descriptors", () => {
	it("accepts exact property revisions for typed numeric and boolean qualifiers", () => {
		const definitionRevisionId = crypto.randomUUID();
		expect(
			CatalogSourceFactDescriptorSchema.parse({
				identity: "order",
				path: "/authors/0",
				definitionRevisionId,
				kind: "number",
				value: 0,
			}),
		).toMatchObject({ definitionRevisionId, value: 0 });
		expect(
			CatalogSourceFactDescriptorSchema.parse({
				identity: "flag",
				path: "/flag",
				definitionRevisionId,
				kind: "boolean",
				value: false,
			}),
		).toMatchObject({ value: false });
		expect(() =>
			CatalogSourceFactDescriptorSchema.parse({
				identity: "order",
				path: "/order",
				definitionRevisionId,
				kind: "number",
				value: Infinity,
			}),
		).toThrow();
	});
	it("keeps named dates strict and requires reviewed definitions for flat structured facts", () => {
		expect(() =>
			CatalogSourceFactDescriptorSchema.parse({
				identity: "date",
				path: "/date",
				namespace: "catalog",
				key: "first-issued-date",
				kind: "object",
				value: { year: 1900, month: null, day: null },
			}),
		).not.toThrow();
		expect(() =>
			CatalogSourceFactDescriptorSchema.parse({
				identity: "date",
				path: "/date",
				definitionRevisionId: crypto.randomUUID(),
				kind: "object",
				value: { nested: { arbitrary: "value" } },
			}),
		).toThrow();
	});
});
