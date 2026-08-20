import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { UnitContentLanguageSupportInvalid } from "./errors";
import {
	isContentLanguageSupportUnitKind,
	normalizeContentLanguageSupportInput,
	presentContentLanguageSupport,
	unitContentLanguageSupportUpsertChangeCondition,
} from "./content-language-support";

describe("Unit content language support boundary", () => {
	it("normalizes external values before they reach persistence", () => {
		const value = normalizeContentLanguageSupportInput([
			{ languageTag: "ZH-hant", channels: ["interface", "text"] },
		]);
		expect(value).toEqual([{ languageTag: "zh-Hant", channels: ["text", "interface"] }]);
		expect(presentContentLanguageSupport(value)).toEqual([
			{ languageTag: "zh-Hant", channels: ["text", "interface"] },
		]);
	});

	it("returns a typed Unit error with the exact invalid path", () => {
		try {
			normalizeContentLanguageSupportInput([{ languageTag: "not a tag" }]);
			expect.unreachable("invalid language tag must fail");
		} catch (error) {
			expect(error).toBeInstanceOf(UnitContentLanguageSupportInvalid);
			if (!(error instanceof UnitContentLanguageSupportInvalid)) throw error;
			expect(error.details.path).toBe("/0/languageTag");
		}
	});

	it("keeps field ownership separate from presentation-only Unit kinds", () => {
		for (const kind of ["book", "software", "media", "video", "audio", "release"] as const)
			expect(isContentLanguageSupportUnitKind(kind)).toBe(true);
		for (const kind of ["series", "entity", "post"] as const)
			expect(isContentLanguageSupportUnitKind(kind)).toBe(false);
	});

	it("guards the upsert atomically against identical JSONB and kind values", () => {
		const rendered = new PgDialect()
			.sqlToQuery(unitContentLanguageSupportUpsertChangeCondition)
			.sql.toLowerCase()
			.replaceAll(/\s+/g, " ")
			.trim();
		expect(rendered).toBe(
			'"unit_content_language_support"."value" is distinct from excluded.value or "unit_content_language_support"."unit_kind" is distinct from excluded.unit_kind',
		);
	});
});
