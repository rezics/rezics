import type { Authorization } from "../authorization";
import { MaximumPostScoreCount } from "../api/posts/schema";
import { and, asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { selfAuthUserIdForEntity } from "../participation/account-query";

import { getProfileActivityReadCondition } from "../authorization/profile-activity/query";

import { database } from "../database";
import { accountPreference, postScore, score, realm } from "../database/schema";
import {
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "../units/localization";

const scoreRealm = alias(realm, "post_score_realm");

export async function selectPostScores(
	postId: string,
	authorization: Authorization,
	localizationLanguages: LocalizationLanguageQuery = [],
) {
	const viewerProfileId = authorization.profileId;
	const rows = await database
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
			),
		)
		.orderBy(asc(postScore.position), asc(postScore.scoreId))
		.limit(MaximumPostScoreCount + 1);
	if (rows.length > MaximumPostScoreCount) throw new Error("Post score attachment bound exceeded");
	const readable = await authorization.unit.readableUnitIds(
		rows.flatMap((row) => [row.unitId, row.realmId]),
	);
	return rows.filter((row) => readable.has(row.unitId) && readable.has(row.realmId));
}
