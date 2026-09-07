import { describe, expect, it } from "vitest";
import {
	CatalogReferenceSchema,
	UnitOwnerValues,
	UnitReferenceSchema,
	SourceObservationReferenceSchema,
} from "./index";

const id = "01992600-0000-7000-8000-000000000001";
describe("owner reference boundaries", () => {
	it("keeps owner identity independent from presentation kinds", () => {
		expect(UnitReferenceSchema.parse({ owner: "post", id })).toEqual({ owner: "post", id });
		for (const owner of ["profile", "zone_page", "book", "slug_namespace", "unknown"])
			expect(UnitReferenceSchema.safeParse({ owner, id }).success).toBe(false);
		expect(new Set(UnitOwnerValues).size).toBe(20);
	});
	it("rejects ambiguous legacy references and unsolicited authority claims", () => {
		for (const input of [
			{ id },
			{ unitId: id },
			{ owner: "music", id: "not-uuid" },
			{ owner: "music", id, canEdit: true },
		])
			expect(UnitReferenceSchema.safeParse(input).success).toBe(false);
	});
	it("restricts catalog and observation reference families", () => {
		expect(CatalogReferenceSchema.safeParse({ owner: "post", id }).success).toBe(false);
		expect(CatalogReferenceSchema.parse({ owner: "distribution", id }).owner).toBe("distribution");
		expect(SourceObservationReferenceSchema.safeParse({ snapshotId: id }).success).toBe(false);
	});
});
