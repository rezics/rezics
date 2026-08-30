import { describe, expect, it } from "vitest";

import {
	renderSubjectAssociationExpressionStatement,
	SubjectAssociationExpressionPreviewLimit,
} from "./subject-association-tags";

describe("subject association Entity Expressions", () => {
	it("uses one source-visible, content-rated, per-Entity bounded query", () => {
		const query = renderSubjectAssociationExpressionStatement({
			entityIds: ["019b76da-a800-7300-8000-000000000003", "019b76da-a800-7300-8000-000000000002"],
			localizationLanguages: ["ja", "en"],
			allowedContentRatings: ["general", "r15"],
			includeSpoilers: false,
			limit: SubjectAssociationExpressionPreviewLimit,
		});
		const normalizedSql = query.sql.toLowerCase().replaceAll(/\s+/g, " ");
		expect(normalizedSql).toContain("cross join lateral");
		expect(normalizedSql).toContain("from public.unit_expression_assertion assertion");
		expect(normalizedSql).toContain("from public.unit_tag direct_tag");
		expect(normalizedSql).toContain("from public.unit_tag_path_application application");
		expect(normalizedSql).toContain("path_stat.score > 0");
		expect(normalizedSql).toContain("focus_unit.content_rating in");
		expect(normalizedSql).toContain("structured.expression_kind <> 'simple'");
		expect(normalizedSql).toContain("presentation.sealed_at is not null");
		expect(normalizedSql).not.toContain("unit_effective_tag");
		expect(normalizedSql).toContain(
			"order by requested_entity.entity_id, ranked.expression_rank nulls first, component.ordinal",
		);
		expect(normalizedSql).toContain("from raw_assertion");
		expect(query.params).toContain(SubjectAssociationExpressionPreviewLimit + 1);
	});

	it("can explicitly include spoiler sources without retaining their source predicate", () => {
		const query = renderSubjectAssociationExpressionStatement({
			entityIds: ["019b76da-a800-7300-8000-000000000002"],
			localizationLanguages: [],
			allowedContentRatings: ["general"],
			includeSpoilers: true,
			limit: 128,
		});
		const normalizedSql = query.sql.toLowerCase().replaceAll(/\s+/g, " ");
		expect(normalizedSql).not.toContain("from public.unit_tag direct_tag");
	});

	it("requires an explicit non-empty Entity owner set", () => {
		expect(() =>
			renderSubjectAssociationExpressionStatement({
				entityIds: [],
				localizationLanguages: [],
				allowedContentRatings: ["general"],
				includeSpoilers: false,
				limit: 4,
			}),
		).toThrow(RangeError);
	});
});
