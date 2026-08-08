import { and, desc, eq, sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import {
	unitExternalLink,
	unitExternalLinkVote,
	unitExternalLinkVoteStat,
} from "../database/schema";
import { ExternalLinkVisibilityScoreThreshold } from "../database/schema/contract-values";
import { wilsonLowerBoundSql } from "../tags/ranking";
import { getReadableUnitPresentationsByIds } from "./attribution";

/** Returns only external links accepted for public detail presentation. */
export async function getAcceptedUnitExternalLinks(unitId: string, viewerProfileId?: string) {
	const rows = await database
		.select({
			id: unitExternalLink.id,
			unitId: unitExternalLink.unitId,
			sourceEntityId: unitExternalLink.sourceEntityId,
			url: unitExternalLink.url,
			normalizedUrl: unitExternalLink.normalizedUrl,
			normalizedUrlHash: unitExternalLink.normalizedUrlHash,
			createdByProfileId: unitExternalLink.createdByProfileId,
			viewerVote: viewerProfileId
				? sql<-1 | 1 | null>`(
					select ${unitExternalLinkVote.value}
					from ${unitExternalLinkVote}
					where ${unitExternalLinkVote.externalLinkId} = ${unitExternalLink.id}
						and ${unitExternalLinkVote.profileId} = ${viewerProfileId}
				)`
				: sql<null>`null`,
			score: unitExternalLinkVoteStat.score,
			voteCount: unitExternalLinkVoteStat.voteCount,
			accepted: sql<true>`true`,
			pinned: unitExternalLink.pinned,
			position: unitExternalLink.position,
			createdAt: unitExternalLink.createdAt,
			updatedAt: unitExternalLink.updatedAt,
		})
		.from(unitExternalLink)
		.leftJoin(
			unitExternalLinkVoteStat,
			eq(unitExternalLinkVoteStat.externalLinkId, unitExternalLink.id),
		)
		.where(
			and(
				eq(unitExternalLink.unitId, unitId),
				sql`${unitExternalLink.pinned} or coalesce(${unitExternalLinkVoteStat.score}, 0) >= ${ExternalLinkVisibilityScoreThreshold}`,
			),
		)
		.orderBy(
			desc(unitExternalLink.pinned),
			sql`case when ${unitExternalLink.pinned} then ${unitExternalLink.position} end asc nulls last`,
			desc(
				wilsonLowerBoundSql(
					unitExternalLinkVoteStat.score,
					unitExternalLinkVoteStat.voteCount,
				),
			),
			desc(unitExternalLinkVoteStat.score),
			desc(unitExternalLinkVoteStat.voteCount),
			unitExternalLink.id,
		);

	return rows.map((link) => ({
		...link,
		score: toSafeInteger(link.score ?? 0n, "external link vote score"),
		voteCount: toSafeInteger(link.voteCount ?? 0n, "external link vote count"),
	}));
}

export async function attachReadableSourceEntities<
	ExternalLink extends { readonly sourceEntityId: string },
>(
	externalLinks: readonly ExternalLink[],
	localizationLanguages: readonly ContentLanguage[],
	profileId?: string,
) {
	const sourceEntities = await getReadableUnitPresentationsByIds({
		unitIds: [...new Set(externalLinks.map(({ sourceEntityId }) => sourceEntityId))],
		localizationLanguages,
		profileId,
	});
	return externalLinks.flatMap((link) => {
		const sourceEntity = sourceEntities.get(link.sourceEntityId);
		return sourceEntity ? [{ ...link, sourceEntity }] : [];
	});
}

/** Returns accepted links only when their localized source Entity is readable. */
export async function getAcceptedUnitExternalLinksWithSources(input: {
	readonly unitId: string;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly profileId?: string;
}) {
	const externalLinks = await getAcceptedUnitExternalLinks(input.unitId, input.profileId);
	return attachReadableSourceEntities(
		externalLinks,
		input.localizationLanguages,
		input.profileId,
	);
}
