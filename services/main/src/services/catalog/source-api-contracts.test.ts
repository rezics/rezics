import { z } from "zod";
import { describe, expect, it } from "vitest";
import * as schemas from "./source-api-contracts";
const id = "019b0000-0000-7000-8000-000000000001";
describe("native source HTTP contracts", () => {
	it("exports every public source schema through the official JSON Schema boundary", () => {
		for (const value of Object.values(schemas))
			if (value instanceof z.ZodType) expect(() => z.toJSONSchema(value)).not.toThrow();
	});
	it("keeps a provider's principal family distinct from its native storage owner", () => {
		expect(schemas.CatalogSourceIntakeKeySchema.parse({ source: "openlibrary", objectType: "edition", externalId: "/books/OL1M" }).objectType).toBe("edition");
		expect(schemas.CatalogSourceIntakeKeySchema.safeParse({ source: "vndb", objectType: "publishing", externalId: id }).success).toBe(false);
		expect(schemas.CatalogSourceIntakeKeySchema.safeParse({ source: "https://attacker.test", objectType: "vn", externalId: "v1" }).success).toBe(false);
	});
	it("requires an exact proposal and mapper for every decision", () => {
		expect(schemas.CatalogSourceDecisionSchema.safeParse({ action: "apply", reason: "Reviewed" }).success).toBe(false);
		expect(schemas.CatalogSourceDecisionSchema.parse({ mappingVersion: "vndb.vn.4", action: "apply", reason: "Reviewed source correction" }).mappingVersion).toBe("vndb.vn.4");
		expect(schemas.CatalogSourceProposalKeySchema.safeParse({ sourceRecordId: id }).success).toBe(false);
	});
	it("requires both tie-breaker keys for bounded binding continuation", () => {
		expect(schemas.CatalogResourceBindingsQuerySchema.safeParse({ afterMappingKey: id }).success).toBe(false);
		expect(schemas.CatalogResourceBindingsQuerySchema.parse({ afterMappingKey: id, afterSourceRecordId: id }).limit).toBe(50);
	});
});
