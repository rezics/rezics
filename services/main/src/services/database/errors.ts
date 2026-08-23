import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

import { databaseErrorMatches } from "./constraint";

export class VndbVoteHotKeyBusy extends Data.TaggedError("VndbVoteHotKeyBusy") {
	static readonly status = StatusCodes.TOO_MANY_REQUESTS as const;
	readonly status = VndbVoteHotKeyBusy.status;
	readonly message = "The vote target is busy; retry shortly";
	readonly retryAfterSeconds = 1;

	constructor(readonly cause?: unknown) {
		super();
	}
}

export class TagNotDirectlyApplicable extends Data.TaggedError("TagNotDirectlyApplicable") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = TagNotDirectlyApplicable.status;
	readonly message = "This Tag cannot be applied directly";
}

export type ContentLabelApplicationInvalidReason =
	| "private_scope"
	| "creator_attribution_required"
	| "pinned_required"
	| "post_kind_required"
	| "public_content_required";

export class ContentLabelApplicationInvalid extends Data.TaggedError(
	"ContentLabelApplicationInvalid",
)<{
	readonly reason: ContentLabelApplicationInvalidReason;
}> {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ContentLabelApplicationInvalid.status;
	readonly message = "This content label cannot be applied to the requested target";
	readonly details: { readonly reason: ContentLabelApplicationInvalidReason };

	constructor(reason: ContentLabelApplicationInvalidReason) {
		super({ reason });
		this.details = { reason };
	}
}

export class ContentLabelJudgmentForbidden extends Data.TaggedError(
	"ContentLabelJudgmentForbidden",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ContentLabelJudgmentForbidden.status;
	readonly message = "Content labels do not accept community judgments";
}

export class ContentLabelUnitMergeForbidden extends Data.TaggedError(
	"ContentLabelUnitMergeForbidden",
) {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = ContentLabelUnitMergeForbidden.status;
	readonly message = "Built-in content-label Tags cannot be merged";
}

export class TagApplicationHasJudgments extends Data.TaggedError("TagApplicationHasJudgments") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = TagApplicationHasJudgments.status;
	readonly message = "This Tag application cannot be removed while it has judgments";
}

export class RealmTagContextInUse extends Data.TaggedError("RealmTagContextInUse") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = RealmTagContextInUse.status;
	readonly message = "This Realm Tag Context cannot be removed while judgments depend on it";
}

export class ContentLabelPlatformApplyForbidden extends Data.TaggedError(
	"ContentLabelPlatformApplyForbidden",
) {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = ContentLabelPlatformApplyForbidden.status;
	readonly message = "Applying a platform content label requires an approved governance decision";
}

export class ContentLabelPlatformIdentityImmutable extends Data.TaggedError(
	"ContentLabelPlatformIdentityImmutable",
) {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = ContentLabelPlatformIdentityImmutable.status;
	readonly message = "A platform content label's identity cannot be changed";
}

export class ContentLabelPlatformRemovalForbidden extends Data.TaggedError(
	"ContentLabelPlatformRemovalForbidden",
) {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = ContentLabelPlatformRemovalForbidden.status;
	readonly message = "Removing a platform content label requires an approved governance decision";
}

export const DatabaseErrors = [
	VndbVoteHotKeyBusy,
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

type VndbPolicyConstraintError = Exclude<
	InstanceType<(typeof DatabaseErrors)[number]>,
	VndbVoteHotKeyBusy
>;

const contentLabelApplicationConstraints = {
	content_label_private_rejected: "private_scope",
	content_label_creator_required: "creator_attribution_required",
	content_label_pinned: "pinned_required",
	content_spoiler_label_post_kind: "post_kind_required",
	nsfw_label_public_content: "public_content_required",
} as const satisfies Record<string, ContentLabelApplicationInvalidReason>;

/** Translates only exact, canonical PostgreSQL policy identities into public API errors. */
export function toVndbPolicyConstraintError(error: unknown): VndbPolicyConstraintError | undefined {
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
