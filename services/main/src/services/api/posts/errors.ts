import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

import { PostTagMentionVoteConflict, PostTargetingLocked } from "../../posts/errors";
export { PostTagMentionVoteConflict, PostTargetingLocked } from "../../posts/errors";

export class PostNotFound extends Data.TaggedError("PostNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = PostNotFound.status;
	readonly message = "Post not found";
}

export class PostLocalizationNotFound extends Data.TaggedError("PostLocalizationNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = PostLocalizationNotFound.status;
	readonly message = "Post localization not found";
}

export class ReplyPostNotFound extends Data.TaggedError("ReplyPostNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ReplyPostNotFound.status;
	readonly message = "Reply post not found";
}

export class ParentReplyNotFound extends Data.TaggedError("ParentReplyNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = ParentReplyNotFound.status;
	readonly message = "Parent reply post not found in thread";
}

export class ReplyDepthExceeded extends Data.TaggedError("ReplyDepthExceeded") {
	static readonly status = StatusCodes.FORBIDDEN as const;
	readonly status = ReplyDepthExceeded.status;
	readonly message = "Maximum reply depth reached";
}

export class PostScoreNotFound extends Data.TaggedError("PostScoreNotFound") {
	static readonly status = StatusCodes.NOT_FOUND as const;
	readonly status = PostScoreNotFound.status;
	readonly message = "Score not found";
}

export class PostScoreDuplicate extends Data.TaggedError("PostScoreDuplicate") {
	static readonly status = StatusCodes.UNPROCESSABLE_ENTITY as const;
	readonly status = PostScoreDuplicate.status;
	readonly message = "A Post cannot display the same Score more than once";
}

export const PostErrors = [
	PostNotFound,
	PostLocalizationNotFound,
	PostTargetingLocked,
	ReplyPostNotFound,
	ParentReplyNotFound,
	ReplyDepthExceeded,
	PostScoreNotFound,
	PostScoreDuplicate,
	PostTagMentionVoteConflict,
] as const;
