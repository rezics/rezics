import { StatusCodes } from "http-status-codes";
import { HTTPError } from "elysia";

export type PostTargetRelation = "subject" | "root" | "parent";

export type PostTargetingLockDetails =
	| {
			scope: "global";
			relation: PostTargetRelation;
			targetUnitId: string;
	  }
	| {
			scope: "realm";
			relation: PostTargetRelation;
			targetUnitId: string;
			realmId: string;
	  };

export class PostTargetingLocked extends HTTPError.id("PostTargetingLocked", StatusCodes.CONFLICT) {
	override readonly message = "The target does not accept new Post relations";

	constructor(readonly details: PostTargetingLockDetails) {
		super();
	}
}

export class PostTagMentionVoteConflict extends HTTPError.id(
	"PostTagMentionVoteConflict",
	StatusCodes.CONFLICT,
) {
	override readonly message =
		"A mentioned Tag cannot be auto-voted because this Profile has already downvoted it on the Post";
}
