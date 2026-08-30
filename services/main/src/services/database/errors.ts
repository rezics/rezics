import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

import { databaseErrorMatches } from "./constraint";

export class VoteHotKeyBusy extends HTTPError.id("VoteHotKeyBusy", StatusCodes.TOO_MANY_REQUESTS) {
	override readonly message = "The vote target is busy; retry shortly";
	readonly retryAfterSeconds = 1;

	constructor(override readonly cause?: unknown) {
		super();
	}
}

export class TagNotDirectlyApplicable extends HTTPError.id(
	"TagNotDirectlyApplicable",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "This Tag cannot be applied directly";
}

export type ContentLabelApplicationInvalidReason =
	| "private_scope"
	| "creator_attribution_required"
	| "pinned_required"
	| "post_kind_required"
	| "public_content_required";

export class ContentLabelApplicationInvalid extends HTTPError.id(
	"ContentLabelApplicationInvalid",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "This content label cannot be applied to the requested target";
	readonly reason: ContentLabelApplicationInvalidReason;
	readonly details: { readonly reason: ContentLabelApplicationInvalidReason };

	constructor(reason: ContentLabelApplicationInvalidReason) {
		super();
		this.reason = reason;
		this.details = { reason };
	}
}

export class ContentLabelJudgmentForbidden extends HTTPError.id(
	"ContentLabelJudgmentForbidden",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Content labels do not accept community judgments";
}

export class ContentLabelUnitMergeForbidden extends HTTPError.id(
	"ContentLabelUnitMergeForbidden",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "Built-in content-label Tags cannot be merged";
}

export class TagApplicationHasJudgments extends HTTPError.id(
	"TagApplicationHasJudgments",
	StatusCodes.CONFLICT,
) {
	override readonly message = "This Tag application cannot be removed while it has judgments";
}

export class RealmTagContextInUse extends HTTPError.id(
	"RealmTagContextInUse",
	StatusCodes.CONFLICT,
) {
	override readonly message =
		"This Realm Tag Context cannot be removed while judgments depend on it";
}

export class ContentLabelPlatformApplyForbidden extends HTTPError.id(
	"ContentLabelPlatformApplyForbidden",
	StatusCodes.FORBIDDEN,
) {
	override readonly message =
		"Applying a platform content label requires an approved governance decision";
}

export class ContentLabelPlatformIdentityImmutable extends HTTPError.id(
	"ContentLabelPlatformIdentityImmutable",
	StatusCodes.CONFLICT,
) {
	override readonly message = "A platform content label's identity cannot be changed";
}

export class ContentLabelPlatformRemovalForbidden extends HTTPError.id(
	"ContentLabelPlatformRemovalForbidden",
	StatusCodes.FORBIDDEN,
) {
	override readonly message =
		"Removing a platform content label requires an approved governance decision";
}

export const DatabaseErrors = [
	VoteHotKeyBusy,
	TagNotDirectlyApplicable,
	ContentLabelApplicationInvalid,
	ContentLabelJudgmentForbidden,
	ContentLabelUnitMergeForbidden,
	TagApplicationHasJudgments,
	RealmTagContextInUse,
	ContentLabelPlatformApplyForbidden,
	ContentLabelPlatformIdentityImmutable,
	ContentLabelPlatformRemovalForbidden,
] as const;

type TagPolicyConstraintError = Exclude<
	InstanceType<(typeof DatabaseErrors)[number]>,
	VoteHotKeyBusy
>;

const contentLabelApplicationConstraints = {
	content_label_private_rejected: "private_scope",
	content_label_creator_required: "creator_attribution_required",
	content_label_pinned: "pinned_required",
	content_spoiler_label_post_kind: "post_kind_required",
	nsfw_label_public_content: "public_content_required",
} as const satisfies Record<string, ContentLabelApplicationInvalidReason>;

/** Translates only exact, canonical PostgreSQL policy identities into public API errors. */
export function toTagPolicyConstraintError(error: unknown): TagPolicyConstraintError | undefined {
	if (databaseErrorMatches(error, { code: "23514", constraint: "tag_directly_applicable" }))
		return new TagNotDirectlyApplicable();

	for (const [constraint, reason] of Object.entries(contentLabelApplicationConstraints))
		if (databaseErrorMatches(error, { code: "23514", constraint }))
			return new ContentLabelApplicationInvalid(reason);

	if (
		databaseErrorMatches(error, {
			code: "23514",
			constraint: "content_label_judgment_rejected",
		})
	)
		return new ContentLabelJudgmentForbidden();
	if (
		databaseErrorMatches(error, {
			code: "23514",
			constraint: "content_label_unit_merge_rejected",
		})
	)
		return new ContentLabelUnitMergeForbidden();
	if (
		databaseErrorMatches(error, {
			code: "23503",
			constraint: "unit_tag_judgment_unit_tag_fkey",
		})
	)
		return new TagApplicationHasJudgments();
	if (
		databaseErrorMatches(error, {
			code: "23503",
			constraint: "realm_tag_judgment_context_fkey",
		})
	)
		return new RealmTagContextInUse();
	if (databaseErrorMatches(error, { code: "23514", constraint: "content_label_platform_apply" }))
		return new ContentLabelPlatformApplyForbidden();
	if (
		databaseErrorMatches(error, {
			code: "23514",
			constraint: "content_label_platform_identity",
		})
	)
		return new ContentLabelPlatformIdentityImmutable();
	if (databaseErrorMatches(error, { code: "23514", constraint: "content_label_platform_remove" }))
		return new ContentLabelPlatformRemovalForbidden();

	return undefined;
}
