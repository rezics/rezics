import { StatusCodes } from "http-status-codes";
import * as Data from "effect/Data";

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

export class PostTargetingLocked extends Data.TaggedError("PostTargetingLocked") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = PostTargetingLocked.status;
	readonly message = "The target does not accept new Post relations";

	constructor(readonly details: PostTargetingLockDetails) {
		super();
	}
}

export class PostTagMentionVoteConflict extends Data.TaggedError("PostTagMentionVoteConflict") {
	static readonly status = StatusCodes.CONFLICT as const;
	readonly status = PostTagMentionVoteConflict.status;
	readonly message =
		"A mentioned Tag cannot be auto-voted because this Profile has already downvoted it on the Post";
}
