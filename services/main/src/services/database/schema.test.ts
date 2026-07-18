import { type SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	unit,
	unitAccessBinding,
	unitAccessRestriction,
	unitAlias,
	unitLocalization,
} from "./schema";

const dialect = new PgDialect();

describe("database schema contracts", () => {
	it("uses PostgreSQL uuidv7 for generated identifiers", () => {
		expect(dialect.sqlToQuery(unit.id.default as SQL).sql).toBe("uuidv7()");
	});

	it("tracks every PGroonga search index in the schema", () => {
		const indexes = [unit, unitAlias, unitLocalization]
			.flatMap((table) => getTableConfig(table).indexes)
			.filter((index) => index.config.method === "pgroonga");

		expect(indexes.map((index) => index.config.name).sort()).toEqual(
			[
				"unit_alias_term_search_idx",
				"unit_localization_content_search_idx",
				"unit_localization_description_search_idx",
				"unit_localization_summary_search_idx",
				"unit_localization_title_search_idx",
				"unit_slug_search_idx",
			].sort(),
		);
		for (const name of [
			"unit_localization_content_search_idx",
			"unit_localization_description_search_idx",
		]) {
			const index = indexes.find((candidate) => candidate.config.name === name);
			const column = index?.config.columns[0];
			expect(
				column && "indexConfig" in column ? column.indexConfig?.opClass : undefined,
			).toBe("pgroonga_jsonb_full_text_search_ops_v2");
		}
		expect(
			indexes.find((index) => index.config.name === "unit_slug_search_idx")?.config.where,
		).toBeDefined();
		expect(
			indexes.find((index) => index.config.name === "unit_alias_term_search_idx")?.config
				.where,
		).toBeDefined();
	});

	it("enforces Unit access subject invariants at the database boundary", () => {
		const binding = getTableConfig(unitAccessBinding);
		const restriction = getTableConfig(unitAccessRestriction);

		expect(binding.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_binding_subject_role_check",
		);
		expect(restriction.checks.map((constraint) => constraint.name)).toContain(
			"unit_access_restriction_subject_shape_check",
		);
		expect(restriction.indexes.map((index) => index.config.name)).toEqual(
			expect.arrayContaining([
				"unit_access_restriction_active_profile_scope_key",
				"unit_access_restriction_active_realm_scope_key",
			]),
		);
		expect(unitAccessRestriction.subjectKind.enumValues).toEqual(["profile", "realm"]);
	});
});
