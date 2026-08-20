import { describe, expect, it } from "vitest";

import {
	presentVariantRelations,
	type UnitVariantSummary,
} from "../model/unit-variant-presentation";
import { publicUnitHref } from "../routing/public-unit-route";

const main = {
	id: "00000000-0000-7000-8000-000000000001",
	type: "entity",
	language: "en",
	title: "Main identity",
	cover: null,
} satisfies UnitVariantSummary;
const variant = {
	id: "00000000-0000-7000-8000-000000000002",
	type: "media",
	language: "ja",
	title: "Adaptation",
	cover: {
		id: "00000000-0000-7000-8000-000000000003",
		url: "https://example.com/cover.webp",
	},
} satisfies UnitVariantSummary;

describe("presentVariantRelations", () => {
	it("presents every child of a main Unit as a variant", () => {
		expect(presentVariantRelations({ role: "main", variants: [variant] })).toEqual([
			{ relation: "variant", unit: variant },
		]);
	});

	it("presents an available main Unit from a variant", () => {
		expect(
			presentVariantRelations({
				role: "variant",
				relationUpdatedAt: "2026-08-20T00:00:00.000Z",
				main: { state: "available", unit: main },
			}),
		).toEqual([{ relation: "main", unit: main }]);
	});

	it("keeps standalone and unavailable relations empty", () => {
		expect(presentVariantRelations({ role: "standalone" })).toEqual([]);
		expect(
			presentVariantRelations({
				role: "variant",
				relationUpdatedAt: "2026-08-20T00:00:00.000Z",
				main: { state: "unavailable" },
			}),
		).toEqual([]);
	});
});

describe("publicUnitHref", () => {
	it("uses the dedicated Entity route and the generic work Unit route", () => {
		expect(publicUnitHref(main.type, main)).toBe(`/entities/${main.id}`);
		expect(publicUnitHref(variant.type, variant)).toBe(`/units/media/${variant.id}`);
	});
});
