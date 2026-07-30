import type {
	GetApiRealmsByRealmIdUnitsByUnitIdTagsStatus200,
	GetApiUnitsByTypeByUnitIdTagsStatus200,
} from "@rezics/openapi-tanstack-query";

import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import type {
	RealmTagGroupPresentation,
	RealmTagVoteContextPresentation,
	TagPresentation,
} from "../model/tag-presentation";

type UnitTagLandscape = GetApiUnitsByTypeByUnitIdTagsStatus200;

export function presentGlobalTags(input: {
	readonly data: UnitTagLandscape;
	readonly type: UnitDetailUnitType;
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
			avatar: tag.avatar,
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
		},
	}));
}

export function presentRealmTagGroups(input: {
	readonly data: UnitTagLandscape;
	readonly unitId: string;
}): readonly RealmTagGroupPresentation[] {
	return input.data.realms.map((realm) => ({
		realmId: realm.realmId,
		language: realm.language,
		title: realm.title,
		summary: realm.summary,
		avatar: realm.avatar,
		canVote: realm.canVote,
		tags: presentRealmTags({
			realm,
			tags: realm.votedTags,
			unitId: input.unitId,
			canVote: realm.canVote,
		}),
	}));
}

export function presentRealmTagVoteContexts(
	data: UnitTagLandscape,
): readonly RealmTagVoteContextPresentation[] {
	return data.voteRealms.map((realm) => ({ ...realm }));
}

export function presentSelectedRealmTags(input: {
	readonly context: RealmTagVoteContextPresentation;
	readonly data: GetApiRealmsByRealmIdUnitsByUnitIdTagsStatus200;
	readonly unitId: string;
}): readonly TagPresentation[] {
	return presentRealmTags({
		realm: input.context,
		tags: input.data.tags,
		unitId: input.unitId,
		canVote: true,
	});
}

function presentRealmTags(input: {
	readonly realm: Pick<RealmTagVoteContextPresentation, "realmId" | "language" | "title">;
	readonly tags: GetApiRealmsByRealmIdUnitsByUnitIdTagsStatus200["tags"];
	readonly unitId: string;
	readonly canVote: boolean;
}): readonly TagPresentation[] {
	return input.tags.map((tag) => ({
		itemKey: `realm:${input.realm.realmId}:${tag.tagId}`,
		identity: {
			tagId: tag.tagId,
			language: tag.language,
			title: tag.title,
			summary: tag.summary,
			avatar: tag.avatar,
		},
		context: {
			kind: "realm",
			realmId: input.realm.realmId,
			realmLanguage: input.realm.language,
			realmTitle: input.realm.title,
			...(tag.contextPostId ? { contextPostId: tag.contextPostId } : {}),
		},
		vote: {
			kind: "available",
			target: {
				kind: "realm",
				realmId: input.realm.realmId,
				unitId: input.unitId,
				tagId: tag.tagId,
			},
			score: toFiniteApiNumber(tag.score) ?? 0,
			voteCount: toNonNegativeApiInteger(tag.voteCount),
			viewerVote: tag.viewerVote,
			canVote: input.canVote,
		},
	}));
}
