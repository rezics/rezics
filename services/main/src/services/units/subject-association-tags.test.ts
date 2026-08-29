import { describe, expect, it } from "vitest";

import {
	renderSubjectAssociationExpressionPreviewStatement,
	SubjectAssociationExpressionPreviewLimit,
} from "./subject-association-tags";

describe("subject association Entity Expression previews", () => {
	it("uses one lateral, definition-hydrated, per-Entity bounded query", () => {
		const query = renderSubjectAssociationExpressionPreviewStatement({
			entityIds: ["019b76da-a800-7300-8000-000000000003", "019b76da-a800-7300-8000-000000000002"],
			localizationLanguages: ["ja", "en"],
		});
		const normalizedSql = query.sql.toLowerCase().replaceAll(/\s+/g, " ");
		expect(normalizedSql).toContain("cross join lateral");
		expect(normalizedSql).toContain("row_number() over");
		expect(normalizedSql).toContain("from public.unit_expression_assertion assertion");
		expect(normalizedSql).toContain("expression.status = 'active'");
		expect(normalizedSql).toContain("presentation.sealed_at is not null");
		expect(normalizedSql).not.toContain("unit_effective_tag");
		expect(normalizedSql).toContain(
			"order by requested_entity.entity_id, ranked.preview_rank, component.ordinal",
		);
		expect(query.params).toContain(SubjectAssociationExpressionPreviewLimit);
	});

	it("requires an explicit non-empty Entity owner set", () => {
		expect(() =>
			renderSubjectAssociationExpressionPreviewStatement({
				entityIds: [],
				localizationLanguages: [],
			}),
		).toThrow(RangeError);
	});
});
