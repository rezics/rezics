import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
	contentPackStructureApplicationEvidence,
	contentPackStructureDefinitionEvidence,
	contentPackSubjectAssociationEvidence,
	contentPackTagEvidence,
	contentPackUnitTagEvidence,
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
	it("retains the exact declared source Path after runtime definition correction", () => {
		const definition = getTableConfig(contentPackStructureDefinitionEvidence);
		expect(definition.columns.map(({ name }) => name)).toContain("member_tag_source_keys");
		expect(contentPackStructureDefinitionEvidence.memberTagSourceKeys.notNull).toBe(true);
		expect(definition.checks.map(({ name }) => name)).toEqual(
			expect.arrayContaining([
				"content_pack_structure_definition_evidence_member_count_check",
				"content_pack_structure_definition_evidence_member_null_check",
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
				contentPackStructureDefinitionEvidence,
				"content_pack_structure_definition_evidence_vote_idx",
			),
		).toEqual(["structure_id", "profile_id", "import_id"]);
		expect(
			indexColumns(contentPackUnitTagEvidence, "content_pack_unit_tag_evidence_judgment_idx"),
		).toEqual(["unit_id", "tag_id", "profile_id", "import_id"]);
		expect(
			indexColumns(
				contentPackStructureApplicationEvidence,
				"content_pack_structure_application_evidence_judgment_idx",
			),
		).toEqual(["unit_id", "structure_id", "profile_id", "import_id"]);
		expect(
			indexColumns(
				contentPackSubjectAssociationEvidence,
				"content_pack_subject_association_evidence_judgment_idx",
			),
		).toEqual(["association_id", "profile_id", "import_id"]);
	});
});
