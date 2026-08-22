import { describe, expect, it } from "vitest";

import {
	renderSubjectAssociationEntityTagPreviewStatement,
	SubjectAssociationEntityTagPreviewLimit,
} from "./subject-association-tags";

describe("subject association Entity Tag previews", () => {
	it("uses one lateral, authorized, per-Entity bounded query", () => {
		const query = renderSubjectAssociationEntityTagPreviewStatement({
			entityIds: ["019b76da-a800-7300-8000-000000000003", "019b76da-a800-7300-8000-000000000002"],
			localizationLanguages: ["ja", "en"],
			profileId: "019b76da-a800-7300-8000-000000000001",
		});
		const normalizedSql = query.sql.toLowerCase().replaceAll(/\s+/g, " ");
		expect(normalizedSql).toContain("cross join lateral");
		expect(normalizedSql).toContain("row_number() over");
		expect(normalizedSql).toContain('"unit_tag"."unit_id" = requested_entity.entity_id');
		expect(normalizedSql).toContain(
			'inner join "unit" as "subject_association_preview_tag_unit" on "subject_association_preview_tag_unit"."id" = "unit_tag"."tag_id"',
		);
		expect(normalizedSql).not.toContain('inner join "subject_association_preview_tag_unit" on');
		expect(normalizedSql).toContain("order by requested_entity.entity_id, ranked.preview_rank");
		expect(query.params).toContain(SubjectAssociationEntityTagPreviewLimit);
	});

	it("requires an explicit non-empty Entity owner set", () => {
		expect(() =>
			renderSubjectAssociationEntityTagPreviewStatement({
				entityIds: [],
				localizationLanguages: [],
			}),
		).toThrow(RangeError);
	});
});
