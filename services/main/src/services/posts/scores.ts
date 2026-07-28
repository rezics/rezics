import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getProfileActivityReadCondition } from "../authorization/profile-activity/query";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import { postScore, profilePreference, score, unit } from "../database/schema";

const scoreTargetUnit = alias(unit, "post_score_target_unit");
const scoreContextUnit = alias(unit, "post_score_context_unit");

export function selectPostScores(postId: string, viewerProfileId?: string) {
	return database
		.select({
			scoreId: score.id,
			profileId: score.profileId,
			unitId: score.unitId,
			contextUnitId: score.contextUnitId,
			value: score.value,
			visibility: score.visibility,
			position: postScore.position,
			updatedAt: score.updatedAt,
		})
		.from(postScore)
		.innerJoin(score, eq(score.id, postScore.scoreId))
		.innerJoin(profilePreference, eq(profilePreference.profileId, score.profileId))
		.innerJoin(scoreTargetUnit, eq(scoreTargetUnit.id, score.unitId))
		.innerJoin(scoreContextUnit, eq(scoreContextUnit.id, score.contextUnitId))
		.where(
			and(
				eq(postScore.postId, postId),
				getProfileActivityReadCondition({
					ownerProfileId: score.profileId,
					categoryVisibility: profilePreference.scoreVisibility,
					itemVisibility: score.visibility,
					viewerProfileId,
					surface: "linked",
				}),
				getUnitReadCondition(viewerProfileId, {}, scoreTargetUnit),
				getUnitReadCondition(viewerProfileId, {}, scoreContextUnit),
			),
		)
		.orderBy(asc(postScore.position), asc(postScore.scoreId));
}
