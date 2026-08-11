import { and, eq, isNull, sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import { database } from "../database";
import {
	unitExternalLink,
	unitExternalLinkVote,
	unitExternalLinkVoteStat,
	UnitExternalLinkPreviewLimit,
	UnitReferenceActiveLimit,
} from "../database/schema";
import { UnitReferenceLimitReached } from "../api/unit-resources/errors";
import { presentBinaryVoteSummary } from "../votes/binary";
import { paginateUnitReferences, unitReferenceRankingVersion } from "./reference-pagination";
import { getReadableUnitPresentationsByIds } from "./attribution";

/** Returns the bounded, community-ranked external-link preview for a Unit detail. */
export async function getUnitExternalLinkPreview(unitId: string, viewerProfileId?: string) {
	const rows = await database
		.select({
			id: unitExternalLink.id,
			unitId: unitExternalLink.unitId,
			sourceEntityId: unitExternalLink.sourceEntityId,
			url: unitExternalLink.url,
			normalizedUrl: unitExternalLink.normalizedUrl,
			normalizedUrlHash: unitExternalLink.normalizedUrlHash,
			createdByProfileId: unitExternalLink.createdByProfileId,
			viewerVote: unitExternalLinkVote.value,
			score: unitExternalLinkVoteStat.score,
			voteCount: unitExternalLinkVoteStat.voteCount,
			voteUpdatedAt: unitExternalLinkVoteStat.updatedAt,
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
		.leftJoin(
			unitExternalLinkVote,
			and(
				eq(unitExternalLinkVote.externalLinkId, unitExternalLink.id),
				viewerProfileId ? eq(unitExternalLinkVote.profileId, viewerProfileId) : sql`false`,
			),
		)
		.where(and(eq(unitExternalLink.unitId, unitId), isNull(unitExternalLink.withdrawnAt)))
		.limit(UnitReferenceActiveLimit + 1);

	if (rows.length > UnitReferenceActiveLimit)
		throw new UnitReferenceLimitReached(UnitReferenceActiveLimit);
	const references = rows.map((row) => {
		const { viewerVote, score, voteCount, voteUpdatedAt, ...reference } = row;
		return {
			...reference,
			voteSummary: presentBinaryVoteSummary({
				score: score ?? 0n,
				voteCount: voteCount ?? 0n,
				viewerVote,
				updatedAt: voteUpdatedAt,
				name: "External link",
			}),
		};
	});
	return paginateUnitReferences({
		references,
		context: {
			unitId,
			kind: "external_link",
			curationVersion: 0,
			rankingVersion: unitReferenceRankingVersion(references),
		},
		limit: UnitExternalLinkPreviewLimit,
	}).items;
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

/** Returns preview links only when their localized source Entity is readable. */
export async function getUnitExternalLinkPreviewWithSources(input: {
	readonly unitId: string;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly profileId?: string;
}) {
	const externalLinks = await getUnitExternalLinkPreview(input.unitId, input.profileId);
	return attachReadableSourceEntities(externalLinks, input.localizationLanguages, input.profileId);
}
