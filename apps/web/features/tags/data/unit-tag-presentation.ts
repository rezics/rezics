import type { GetApiUnitsByTypeByUnitIdTagsStatus200 } from "@rezics/openapi-tanstack-query";

import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import type { RealmTagGroupPresentation, TagPresentation } from "../model/tag-presentation";

type UnitTagLandscape = GetApiUnitsByTypeByUnitIdTagsStatus200;

export function presentGlobalTags(input: {
	readonly data: UnitTagLandscape;
	readonly type: CatalogDetailUnitType;
	readonly unitId: string;
	readonly signedIn: boolean;
}): readonly TagPresentation[] {
	return input.data.global.map((tag) => ({
		itemKey: `global:${tag.tagId}`,
		identity: {
			tagId: tag.tagId,
			language: tag.language,
			title: tag.title,
			summary: tag.summary,
		},
		context: { kind: "global", pinned: tag.pinned },
		vote: {
			kind: "available",
			target: {
				kind: "global",
				type: input.type,
				unitId: input.unitId,
				tagId: tag.tagId,
			},
			score: toFiniteApiNumber(tag.score) ?? 0,
			voteCount: toNonNegativeApiInteger(tag.voteCount),
			viewerVote: tag.viewerVote,
			canVote: input.signedIn,
			...(input.signedIn ? {} : { unavailableReason: "signed-out" as const }),
		},
	}));
}

export function presentRealmTagGroups(input: {
	readonly data: UnitTagLandscape;
	readonly unitId: string;
}): readonly RealmTagGroupPresentation[] {
	return input.data.realms.flatMap((realm) => {
		const byTagId = new Map<string, TagPresentation>();
		for (const tag of realm.policyTags) {
			byTagId.set(tag.tagId, {
				itemKey: `realm:${realm.realmId}:${tag.tagId}`,
				identity: {
					tagId: tag.tagId,
					language: tag.language,
					title: tag.title,
					summary: tag.summary,
				},
				context: {
					kind: "realm",
					realmId: realm.realmId,
					realmLanguage: realm.language,
					realmTitle: realm.title,
					policy: true,
				},
				vote: { kind: "not-applicable", reason: "policy" },
			});
		}
		for (const tag of realm.votedTags) {
			const policy = byTagId.has(tag.tagId);
			byTagId.set(tag.tagId, {
				itemKey: `realm:${realm.realmId}:${tag.tagId}`,
				identity: {
					tagId: tag.tagId,
					language: tag.language,
					title: tag.title,
					summary: tag.summary,
				},
				context: {
					kind: "realm",
					realmId: realm.realmId,
					realmLanguage: realm.language,
					realmTitle: realm.title,
					policy,
					contextPostId: tag.contextPostId,
				},
				vote: {
					kind: "available",
					target: {
						kind: "realm",
						realmId: realm.realmId,
						unitId: input.unitId,
						tagId: tag.tagId,
					},
					score: toFiniteApiNumber(tag.score) ?? 0,
					voteCount: toNonNegativeApiInteger(tag.voteCount),
					viewerVote: tag.viewerVote,
					canVote: realm.canVote,
					...(realm.canVote ? {} : { unavailableReason: "not-member" as const }),
				},
			});
		}
		const tags = [...byTagId.values()];
		return tags.length
			? [
					{
						realmId: realm.realmId,
						language: realm.language,
						title: realm.title,
						summary: realm.summary,
						tags,
					},
				]
			: [];
	});
}
