import type { Authorization } from "../authorization";
import { and, eq, isNull } from "drizzle-orm";

import { authEntity } from "../database/schema/participation";

import { getProfileActivityReadCondition } from "../authorization/profile-activity/query";

import { database } from "../database";
import {
	accountPreference,
	postProgressEntry,
	unitProgress,
	unitProgressEntry,
} from "../database/schema";

export async function selectPostProgressEntry(postId: string, authorization: Authorization) {
	const viewerProfileId = authorization.profileId;
	const rows = await database
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
			),
		)
		.limit(1);
	const row = rows[0];
	return row && (await authorization.unit.canRead(row.unitId)) ? [row] : [];
}
