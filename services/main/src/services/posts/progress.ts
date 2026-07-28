import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getProfileActivityReadCondition } from "../authorization/profile-activity/query";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import {
	postProgressEntry,
	profilePreference,
	unit,
	unitProgress,
	unitProgressEntry,
} from "../database/schema";

const progressTargetUnit = alias(unit, "post_progress_target_unit");

export function selectPostProgressEntry(postId: string, viewerProfileId?: string) {
	return database
		.select({
			id: unitProgressEntry.id,
			profileId: unitProgressEntry.profileId,
			unitId: unitProgressEntry.unitId,
			entryKind: unitProgressEntry.entryKind,
			status: unitProgressEntry.status,
			progress: unitProgressEntry.progress,
			completionDelta: unitProgressEntry.completionDelta,
			totalTimeMs: unitProgressEntry.totalTimeMs,
			lastContentStructureNodeId: unitProgressEntry.contentStructureNodeId,
			contentStructureRevisionId: unitProgressEntry.contentStructureRevisionId,
			occurredAt: unitProgressEntry.occurredAt,
			datePrecision: unitProgressEntry.datePrecision,
			sourceKind: unitProgressEntry.sourceKind,
			sourceProvider: unitProgressEntry.sourceProvider,
			sourceExternalId: unitProgressEntry.sourceExternalId,
			affectsCurrent: unitProgressEntry.affectsCurrent,
			createdAt: unitProgressEntry.createdAt,
			updatedAt: unitProgressEntry.updatedAt,
		})
		.from(postProgressEntry)
		.innerJoin(unitProgressEntry, eq(unitProgressEntry.id, postProgressEntry.progressEntryId))
		.innerJoin(
			unitProgress,
			and(
				eq(unitProgress.profileId, unitProgressEntry.profileId),
				eq(unitProgress.unitId, unitProgressEntry.unitId),
			),
		)
		.innerJoin(profilePreference, eq(profilePreference.profileId, unitProgressEntry.profileId))
		.innerJoin(progressTargetUnit, eq(progressTargetUnit.id, unitProgressEntry.unitId))
		.where(
			and(
				eq(postProgressEntry.postId, postId),
				isNull(unitProgressEntry.deletedAt),
				isNull(unitProgress.deletedAt),
				getProfileActivityReadCondition({
					ownerProfileId: unitProgressEntry.profileId,
					categoryVisibility: profilePreference.progressVisibility,
					itemVisibility: unitProgress.visibility,
					viewerProfileId,
					surface: "linked",
				}),
				getUnitReadCondition(viewerProfileId, {}, progressTargetUnit),
			),
		)
		.limit(1);
}
