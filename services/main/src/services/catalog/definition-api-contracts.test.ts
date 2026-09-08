import { z } from "zod";
import { describe, expect, it } from "vitest";
import * as schemas from "./definition-api-contracts";
describe("governed definition HTTP contracts", () => {
	const definition = { namespace: "catalog.character", key: "height", kind: "property", valueKind: "number",
		constraints: { minimum: 0, unit: "cm" }, labels: [{ languageTag: "en", label: "Height" }], reason: "Use the declared measurement unit" };
	it("exports the official JSON Schema without a hidden runtime transform", () => {
		for (const schema of Object.values(schemas)) if (schema instanceof z.ZodType)
			expect(() => z.toJSONSchema(schema)).not.toThrow();
	});
	it("requires canonical-language uniqueness, real names and a bounded review", () => {
		expect(schemas.CreateCatalogDefinitionSchema.parse(definition).labels[0]?.description).toBeNull();
		expect(schemas.CreateCatalogDefinitionSchema.safeParse({ ...definition, labels: [{ languageTag: "en", label: "Height" }, { languageTag: "EN", label: "Height" }] }).success).toBe(false);
		expect(schemas.CreateCatalogDefinitionSchema.safeParse({ ...definition, labels: [{ languageTag: "not a language", label: "Height" }] }).success).toBe(false);
		expect(schemas.CreateCatalogDefinitionSchema.safeParse({ ...definition, labels: [] }).success).toBe(false);
		expect(schemas.CreateCatalogDefinitionSchema.safeParse({ ...definition, reason: "" }).success).toBe(false);
		expect(schemas.CreateCatalogDefinitionSchema.safeParse({ ...definition, labels: [{ languageTag: "en", label: "😀".repeat(201) }] }).success).toBe(false);
	});
	it("requires both stable cursor components and a bounded page", () => {
		expect(schemas.CatalogDefinitionQuerySchema.safeParse({ afterKey: "height" }).success).toBe(false);
		expect(schemas.CatalogDefinitionQuerySchema.parse({ afterNamespace: "catalog.character", afterKey: "height" }).limit).toBe(25);
		expect(schemas.CatalogDefinitionQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
	});
});
