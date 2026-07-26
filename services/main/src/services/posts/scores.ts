import { asc, eq } from "drizzle-orm";

import { database } from "../database";
import { postScore, score } from "../database/schema";

export function selectPostScores(postId: string) {
	return database
		.select({
			scoreId: score.id,
			profileId: score.profileId,
			unitId: score.unitId,
			contextUnitId: score.contextUnitId,
			value: score.value,
			position: postScore.position,
			updatedAt: score.updatedAt,
		})
		.from(postScore)
		.innerJoin(score, eq(score.id, postScore.scoreId))
		.where(eq(postScore.postId, postId))
		.orderBy(asc(postScore.position), asc(postScore.scoreId));
}
