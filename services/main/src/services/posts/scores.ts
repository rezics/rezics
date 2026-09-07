import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { selfAuthUserIdForEntity } from "../participation/account-query";

import { getProfileActivityReadCondition } from "../authorization/profile-activity/query";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import { accountPreference, postScore, score, unit } from "../database/schema";
import {
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "../units/localization";

const scoreTargetUnit = alias(unit, "post_score_target_unit");
const scoreRealm = alias(unit, "post_score_realm");

export function selectPostScores(
	postId: string,
	viewerProfileId?: string,
	localizationLanguages: LocalizationLanguageQuery = [],
) {
	return database
		.select({
			scoreId: score.id,
			profileId: score.profileId,
			unitId: score.unitId,
			realmId: score.realmId,
			realmTitle: resolvedUnitLocalizationTitle(scoreRealm.id, localizationLanguages),
			value: score.value,
			visibility: score.visibility,
			position: postScore.position,
			updatedAt: score.updatedAt,
		})
		.from(postScore)
		.innerJoin(score, eq(score.id, postScore.scoreId))
		.innerJoin(
			accountPreference,
			eq(accountPreference.authUserId, selfAuthUserIdForEntity(score.profileId)),
		)
		.innerJoin(scoreTargetUnit, eq(scoreTargetUnit.id, score.unitId))
		.innerJoin(scoreRealm, eq(scoreRealm.id, score.realmId))
		.where(
			and(
				eq(postScore.postId, postId),
				getProfileActivityReadCondition({
					ownerProfileId: score.profileId,
					categoryVisibility: accountPreference.scoreVisibility,
					itemVisibility: score.visibility,
					viewerProfileId,
					surface: "linked",
				}),
				getUnitReadCondition(viewerProfileId, {}, scoreTargetUnit),
				getUnitReadCondition(viewerProfileId, {}, scoreRealm),
			),
		)
		.orderBy(asc(postScore.position), asc(postScore.scoreId));
}
