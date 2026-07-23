import { describe, expect, it } from "vitest";

import { CatalogDetailSections } from "../model/catalog-detail-section";
import {
	catalogDetailHref,
	getCatalogDetailHrefs,
	parseCatalogDetailSection,
} from "./catalog-detail-routes";

const UnitId = "019b76da-a800-7300-8000-000000000001";

describe("catalog detail routes", () => {
	it("keeps the overview at the immutable Unit identity route", () => {
		expect(catalogDetailHref("book", UnitId)).toBe(`/units/book/${UnitId}`);
		expect(parseCatalogDetailSection(`/units/book/${UnitId}`, "book", UnitId)).toBe("overview");
	});

	it("builds every domain-specific tab as a distinct page", () => {
		for (const type of ["book", "media", "software"] as const) {
			expect(getCatalogDetailHrefs(type, UnitId).map(({ id }) => id)).toEqual(
				CatalogDetailSections[type],
			);
		}
		expect(catalogDetailHref("book", UnitId, "contents")).toBe(
			`/units/book/${UnitId}/contents`,
		);
		expect(catalogDetailHref("software", UnitId, "requirements")).toBe(
			`/units/software/${UnitId}/requirements`,
		);
	});

	it("rejects a section that belongs to another domain", () => {
		expect(
			parseCatalogDetailSection(`/units/media/${UnitId}/contents`, "media", UnitId),
		).toBeUndefined();
		expect(
			parseCatalogDetailSection(`/units/book/${UnitId}/requirements`, "book", UnitId),
		).toBeUndefined();
		expect(
			parseCatalogDetailSection(`/units/book/${UnitId}/reviews/extra`, "book", UnitId),
		).toBeUndefined();
	});
});
