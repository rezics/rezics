import { z } from "zod";
import { describe, expect, it } from "vitest";
import { catalogValueNodes } from "./value-nodes";
import * as contracts from "./semantic-api-contracts";
const id = "019b0000-0000-7000-8000-000000000001";
const fact = { expectedRevision: 1, definitionRevisionId: id, nodes: [...catalogValueNodes("Example")] };
describe("native semantic API contracts", () => {
	it("serializes the public schemas for the official OpenAPI generator", () => {
		for (const value of Object.values(contracts))
			if (value instanceof z.ZodType) expect(() => z.toJSONSchema(value)).not.toThrow();
	});
	it("requires a complete exact semantic replacement fence", () => {
		expect(contracts.WriteCatalogFactSchema.parse(fact).replaces).toBeUndefined();
		expect(contracts.WriteCatalogFactSchema.parse({ ...fact, replaces: { semanticId: id, headVersion: 3 } }).replaces?.headVersion).toBe(3);
		for (const replaces of [{ semanticId: id }, { headVersion: 3 }, { semanticId: id, headVersion: 0 }])
			expect(contracts.WriteCatalogFactSchema.safeParse({ ...fact, replaces }).success).toBe(false);
	});
	it("bounds node count and serialized bytes before opening a mutation", () => {
		expect(contracts.WriteCatalogFactSchema.safeParse({ ...fact, nodes: [...catalogValueNodes(Array(512).fill(null))] }).success).toBe(false);
		expect(contracts.WriteCatalogFactSchema.safeParse({ ...fact, nodes: [...catalogValueNodes("字".repeat(180000))] }).success).toBe(false);
	});
	it("retains one relation's roles, typed targets and independent qualifiers", () => {
		const body = { expectedRevision: 2, definitionRevisionId: id,
			participants: [{ roleRevisionId: id, target: { owner: "publishing", id }, creditedAs: "某作者" }],
			qualifiers: [{ definitionRevisionId: id, valueFactId: id }] };
		expect(contracts.WriteCatalogRelationSchema.parse(body).participants[0]?.creditedAs).toBe("某作者");
		expect(contracts.WriteCatalogRelationSchema.safeParse({ ...body, participants: [{ roleRevisionId: id, target: { owner: "book", id } }] }).success).toBe(false);
	});
	it("reactivation uses an explicit restoration command", () => {
		expect(contracts.CatalogSemanticStateSchema.safeParse({ expectedRevision: 2, expectedHeadVersion: 1, state: "active" }).success).toBe(false);
		expect(contracts.CatalogSemanticRestoreSchema.parse({ expectedRevision: 2, expectedHeadVersion: 1, restoreVersion: 1 }).restoreVersion).toBe(1);
	});
});
