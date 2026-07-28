import { and, eq, isNull } from "drizzle-orm";

import { database } from "../database";
import { postProgressEntry, unitProgressEntry } from "../database/schema";

export function selectPostProgressEntry(postId: string) {
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
		.where(and(eq(postProgressEntry.postId, postId), isNull(unitProgressEntry.deletedAt)))
		.limit(1);
}
