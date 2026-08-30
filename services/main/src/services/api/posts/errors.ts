import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

import { PostTagMentionVoteConflict, PostTargetingLocked } from "../../posts/errors";
export { PostTagMentionVoteConflict, PostTargetingLocked } from "../../posts/errors";

export class PostNotFound extends HTTPError.id("PostNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Post not found";
}

export class PostLocalizationNotFound extends HTTPError.id(
	"PostLocalizationNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Post localization not found";
}

export class ReplyPostNotFound extends HTTPError.id("ReplyPostNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Reply post not found";
}

export class ParentReplyNotFound extends HTTPError.id(
	"ParentReplyNotFound",
	StatusCodes.NOT_FOUND,
) {
	override readonly message = "Parent reply post not found in thread";
}

export class ReplyDepthExceeded extends HTTPError.id("ReplyDepthExceeded", StatusCodes.FORBIDDEN) {
	override readonly message = "Maximum reply depth reached";
}

export class PostScoreNotFound extends HTTPError.id("PostScoreNotFound", StatusCodes.NOT_FOUND) {
	override readonly message = "Score not found";
}

export class PostScoreDuplicate extends HTTPError.id(
	"PostScoreDuplicate",
	StatusCodes.UNPROCESSABLE_ENTITY,
) {
	override readonly message = "A Post cannot display the same Score more than once";
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
