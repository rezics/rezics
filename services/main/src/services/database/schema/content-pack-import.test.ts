import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	contentPackTagPathDefinitionEvidence,
	contentPackSubjectAssociationEvidence,
	contentPackTagEvidence,
	contentPackUnitTagEvidence,
	contentPackUnitTagPathEvidence,
} from "./content-pack-import";

function indexColumns(
	table: Parameters<typeof getTableConfig>[0],
	name: string,
): readonly (string | undefined)[] | undefined {
	return getTableConfig(table)
		.indexes.find((candidate) => candidate.config.name === name)
		?.config.columns.map((column) => ("name" in column ? column.name : undefined));
}

describe("content-pack import evidence schema", () => {
	it("retains the exact immutable source Path definition", () => {
		const definition = getTableConfig(contentPackTagPathDefinitionEvidence);
		expect(definition.columns.map(({ name }) => name)).toContain("member_tag_source_keys");
		expect(contentPackTagPathDefinitionEvidence.memberTagSourceKeys.notNull).toBe(true);
		expect(definition.checks.map(({ name }) => name)).toEqual(
			expect.arrayContaining([
				"content_pack_tag_path_definition_evidence_member_count_check",
				"content_pack_tag_path_definition_evidence_member_null_check",
			]),
		);
	});

	it("keeps every provenance lookup and merge retarget on a selective left-prefix index", () => {
		expect(indexColumns(contentPackTagEvidence, "content_pack_tag_evidence_tag_idx")).toEqual([
			"tag_id",
			"import_id",
		]);
		expect(
			indexColumns(
				contentPackTagPathDefinitionEvidence,
				"content_pack_tag_path_definition_evidence_vote_idx",
			),
		).toEqual(["path_id", "profile_id", "import_id"]);
		expect(
			indexColumns(contentPackUnitTagEvidence, "content_pack_unit_tag_evidence_judgment_idx"),
		).toEqual(["unit_id", "tag_id", "profile_id", "import_id"]);
		expect(
			indexColumns(
				contentPackUnitTagPathEvidence,
				"content_pack_unit_tag_path_evidence_judgment_idx",
			),
		).toEqual(["unit_id", "path_id", "profile_id", "import_id"]);
		expect(
			indexColumns(
				contentPackSubjectAssociationEvidence,
				"content_pack_subject_association_evidence_judgment_idx",
			),
		).toEqual(["association_id", "profile_id", "import_id"]);
	});
});
