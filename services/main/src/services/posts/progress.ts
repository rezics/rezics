import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { authEntity } from "../database/schema/participation";

import { getProfileActivityReadCondition } from "../authorization/profile-activity/query";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import {
	accountPreference,
	postProgressEntry,
	unit,
	unitProgress,
	unitProgressEntry,
} from "../database/schema";

const progressTargetUnit = alias(unit, "post_progress_target_unit");

export function selectPostProgressEntry(postId: string, viewerProfileId?: string) {
	return database
		.select({
			id: unitProgressEntry.id,
			entityId: authEntity.entityId,
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
			createdAt: unitProgressEntry.createdAt,
			updatedAt: unitProgressEntry.updatedAt,
		})
		.from(postProgressEntry)
		.innerJoin(unitProgressEntry, eq(unitProgressEntry.id, postProgressEntry.progressEntryId))
		.innerJoin(
			unitProgress,
			and(
				eq(unitProgress.authUserId, unitProgressEntry.authUserId),
				eq(unitProgress.unitId, unitProgressEntry.unitId),
			),
		)
		.innerJoin(authEntity, eq(authEntity.authUserId, unitProgressEntry.authUserId))
		.innerJoin(accountPreference, eq(accountPreference.authUserId, unitProgressEntry.authUserId))
		.innerJoin(progressTargetUnit, eq(progressTargetUnit.id, unitProgressEntry.unitId))
		.where(
			and(
				eq(postProgressEntry.postId, postId),
				isNull(unitProgressEntry.deletedAt),
				isNull(unitProgress.deletedAt),
				getProfileActivityReadCondition({
					ownerProfileId: authEntity.entityId,
					categoryVisibility: accountPreference.progressVisibility,
					itemVisibility: unitProgress.visibility,
					viewerProfileId,
					surface: "linked",
				}),
				getUnitReadCondition(viewerProfileId, {}, progressTargetUnit),
			),
		)
		.limit(1);
}
