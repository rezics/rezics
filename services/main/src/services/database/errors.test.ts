import { describe, expect, it } from "vitest";

import {
	ContentLabelApplicationInvalid,
	ContentLabelJudgmentForbidden,
	ContentLabelUnitMergeForbidden,
	ContentLabelPlatformApplyForbidden,
	ContentLabelPlatformIdentityImmutable,
	ContentLabelPlatformRemovalForbidden,
	RealmTagContextInUse,
	TagApplicationHasJudgments,
	TagNotDirectlyApplicable,
	toVndbPolicyConstraintError,
} from "./errors";

const postgresError = (constraint: string, code = "23514") => ({ code, constraint });

describe("VNDB policy database errors", () => {
	it("maps direct applicability and content-label guards by exact database identity", () => {
		expect(toVndbPolicyConstraintError(postgresError("tag_directly_applicable"))).toBeInstanceOf(
			TagNotDirectlyApplicable,
		);
		expect(
			toVndbPolicyConstraintError(postgresError("content_label_judgment_rejected")),
		).toBeInstanceOf(ContentLabelJudgmentForbidden);

		const application = toVndbPolicyConstraintError(
			postgresError("content_spoiler_label_post_kind"),
		);
		expect(application).toBeInstanceOf(ContentLabelApplicationInvalid);
		expect(application).toMatchObject({ details: { reason: "post_kind_required" } });
	});

	it.each([
		["content_label_platform_apply", ContentLabelPlatformApplyForbidden],
		["content_label_platform_identity", ContentLabelPlatformIdentityImmutable],
		["content_label_platform_remove", ContentLabelPlatformRemovalForbidden],
	] as const)("maps the action-specific %s guard", (constraint, ErrorClass) => {
		expect(toVndbPolicyConstraintError(postgresError(constraint))).toBeInstanceOf(ErrorClass);
	});

	it("maps fixed content-label merge and fail-closed evidence constraints exactly", () => {
		expect(
			toVndbPolicyConstraintError(postgresError("content_label_unit_merge_rejected")),
		).toBeInstanceOf(ContentLabelUnitMergeForbidden);
		expect(
			toVndbPolicyConstraintError(postgresError("unit_tag_judgment_unit_tag_fkey", "23503")),
		).toBeInstanceOf(TagApplicationHasJudgments);
		expect(
			toVndbPolicyConstraintError(postgresError("realm_tag_judgment_context_fkey", "23503")),
		).toBeInstanceOf(RealmTagContextInUse);
	});

	it("does not translate a matching name with the wrong SQLSTATE", () => {
		expect(
			toVndbPolicyConstraintError(postgresError("content_label_platform_apply", "42501")),
		).toBeUndefined();
		expect(
			toVndbPolicyConstraintError(postgresError("unit_tag_judgment_unit_tag_fkey", "23514")),
		).toBeUndefined();
		expect(
			toVndbPolicyConstraintError(postgresError("content_label_platform_governance", "55000")),
		).toBeUndefined();
		expect(
			toVndbPolicyConstraintError(postgresError("content_label_platform_governance")),
		).toBeUndefined();
		expect(toVndbPolicyConstraintError(postgresError("unrelated_constraint"))).toBeUndefined();
	});
});
