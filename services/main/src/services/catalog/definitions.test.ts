import { describe, expect, it } from "vitest";
import { CatalogDefinitionConstraintsSchema } from "@rezics/schema/contracts/native/definition";
import { validateCatalogParticipants, validateCatalogScalar } from "./definitions";
import { catalogValueNodes } from "./value-nodes";
const role = "019a0000-0000-7000-8000-000000000001";
function scalar(value: unknown) {
	const node = catalogValueNodes(value).next().value;
	if (!node) throw new Error("Missing node");
	return node;
}
describe("governed native semantics", () => {
	it("rejects plausible but wrong roles, target shapes and cardinalities", () => {
		const constraints = CatalogDefinitionConstraintsSchema.parse({
			roles: [
				{
					roleRevisionId: role,
					min: 1,
					max: 1,
					targets: [{ owner: "entity", shapes: ["person"] }],
				},
			],
		});
		expect(() =>
			validateCatalogParticipants(constraints, [
				{ roleRevisionId: role, target: { owner: "entity", shape: "person" } },
			]),
		).not.toThrow();
		expect(() => validateCatalogParticipants(constraints, [])).toThrow("cardinality");
		expect(() =>
			validateCatalogParticipants(constraints, [
				{ roleRevisionId: role, target: { owner: "entity", shape: "character" } },
			]),
		).toThrow("shape");
		expect(() =>
			validateCatalogParticipants(constraints, [
				{ roleRevisionId: role, target: { owner: "music", shape: "person" } },
			]),
		).toThrow("shape");
		expect(() =>
			validateCatalogParticipants(constraints, [
				{ roleRevisionId: role, target: { owner: "entity", shape: "person" } },
				{ roleRevisionId: role, target: { owner: "entity", shape: "person" } },
			]),
		).toThrow("cardinality");
	});
	it("keeps absent data distinct from valid zero and verifies units' numeric domain", () => {
		const constraints = CatalogDefinitionConstraintsSchema.parse({
			unit: "cm",
			minimum: 0,
			maximum: 400,
		});
		expect(() => validateCatalogScalar(scalar(0), constraints, "number")).not.toThrow();
		expect(() => validateCatalogScalar(scalar(null), constraints, "number")).toThrow("type");
		expect(() => validateCatalogScalar(scalar(-1), constraints, "number")).toThrow("numeric");
		expect(() => validateCatalogScalar(scalar(401), constraints, "number")).toThrow("numeric");
		expect(() =>
			validateCatalogScalar(scalar(null), { ...constraints, nullable: true }, "number"),
		).not.toThrow();
	});
	it("rejects vocabulary mismatches and unsafe integer precision", () => {
		const vocabulary = CatalogDefinitionConstraintsSchema.parse({
			allowedValues: ["female", "male", "unknown"],
		});
		expect(() => validateCatalogScalar(scalar("other"), vocabulary, "string")).toThrow("member");
		const integer = CatalogDefinitionConstraintsSchema.parse({ integer: true });
		expect(() => validateCatalogScalar(scalar(1.2), integer, "number")).toThrow("numeric");
		expect(() =>
			validateCatalogScalar(scalar(Number.MAX_SAFE_INTEGER + 1), integer, "number"),
		).toThrow("numeric");
	});
	it("requires bounded unambiguous parent-before-child structured grammar", () => {
		expect(
			CatalogDefinitionConstraintsSchema.safeParse({
				rules: [
					{ position: 0, parent: null, memberKey: null, kind: "array" },
					{ position: 1, parent: 0, memberKey: null, kind: "object" },
					{ position: 2, parent: 1, memberKey: "credit", kind: "string" },
				],
			}).success,
		).toBe(true);
		expect(
			CatalogDefinitionConstraintsSchema.safeParse({
				rules: [
					{ position: 0, parent: null, memberKey: null, kind: "object" },
					{ position: 1, parent: 0, memberKey: "credit", kind: "string" },
					{ position: 2, parent: 0, memberKey: "credit", kind: "number" },
				],
			}).success,
		).toBe(false);
		expect(
			CatalogDefinitionConstraintsSchema.safeParse({
				roles: [
					{
						roleRevisionId: role,
						min: 2,
						max: 1,
						targets: [{ owner: "entity", shapes: ["person"] }],
					},
				],
			}).success,
		).toBe(false);
	});
	it("counts Unicode code points consistently with PostgreSQL length", () => {
		const text = CatalogDefinitionConstraintsSchema.parse({ minLength: 1, maxLength: 1 });
		expect(() => validateCatalogScalar(scalar("😀"), text, "string")).not.toThrow();
		expect(() => validateCatalogScalar(scalar("😀😀"), text, "string")).toThrow("text");
	});
});
