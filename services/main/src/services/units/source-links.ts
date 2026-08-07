import { and, desc, eq, sql } from "drizzle-orm";

import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import { unitSourceLink, unitSourceLinkVote, unitSourceLinkVoteStat } from "../database/schema";
import { SourceLinkVisibilityScoreThreshold } from "../database/schema/contract-values";
import { wilsonLowerBoundSql } from "../tags/ranking";

/** Returns only source links accepted for public detail presentation. */
export async function getAcceptedUnitSourceLinks(unitId: string, viewerProfileId?: string) {
	const rows = await database
		.select({
			id: unitSourceLink.id,
			unitId: unitSourceLink.unitId,
			sourceEntityId: unitSourceLink.sourceEntityId,
			url: unitSourceLink.url,
			normalizedUrl: unitSourceLink.normalizedUrl,
			normalizedUrlHash: unitSourceLink.normalizedUrlHash,
			createdByProfileId: unitSourceLink.createdByProfileId,
			viewerVote: viewerProfileId
				? sql<-1 | 1 | null>`(
					select ${unitSourceLinkVote.value}
					from ${unitSourceLinkVote}
					where ${unitSourceLinkVote.linkId} = ${unitSourceLink.id}
						and ${unitSourceLinkVote.profileId} = ${viewerProfileId}
				)`
				: sql<null>`null`,
			score: unitSourceLinkVoteStat.score,
			voteCount: unitSourceLinkVoteStat.voteCount,
			accepted: sql<true>`true`,
			pinned: unitSourceLink.pinned,
			position: unitSourceLink.position,
			createdAt: unitSourceLink.createdAt,
			updatedAt: unitSourceLink.updatedAt,
		})
		.from(unitSourceLink)
		.leftJoin(unitSourceLinkVoteStat, eq(unitSourceLinkVoteStat.linkId, unitSourceLink.id))
		.where(
			and(
				eq(unitSourceLink.unitId, unitId),
				sql`${unitSourceLink.pinned} or coalesce(${unitSourceLinkVoteStat.score}, 0) >= ${SourceLinkVisibilityScoreThreshold}`,
			),
		)
		.orderBy(
			desc(unitSourceLink.pinned),
			sql`case when ${unitSourceLink.pinned} then ${unitSourceLink.position} end asc nulls last`,
			desc(
				wilsonLowerBoundSql(unitSourceLinkVoteStat.score, unitSourceLinkVoteStat.voteCount),
			),
			desc(unitSourceLinkVoteStat.score),
			desc(unitSourceLinkVoteStat.voteCount),
			unitSourceLink.id,
		);

	return rows.map((link) => ({
		...link,
		score: toSafeInteger(link.score ?? 0n, "source link vote score"),
		voteCount: toSafeInteger(link.voteCount ?? 0n, "source link vote count"),
	}));
}
