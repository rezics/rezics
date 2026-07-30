import { and, desc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContentLanguage } from "@rezics/i18n";
import { getRealmContributionCondition } from "../authorization/realm/query";
import { getUnitReadCondition } from "../authorization/unit/query";
import { database } from "../database";
import { toSafeInteger } from "../database/integer";
import {
	profileRealmTagSubscription,
	realm,
	realmMember,
	realmTagContext,
	realmTagVote,
	realmTagVoteStat,
	realmUnit,
	tag,
	unit,
	unitEffectiveTag,
	unitEffectiveTagVote,
	unitTag,
	unitTagVoteStat,
} from "../database/schema";
import { listVisibleUnitTagStructures } from "../tag-structures/service";
import {
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
} from "../units/localization";
import { presentAvatar } from "../units/avatar";
import { selectRealmTagSources } from "./landscape";
import { compareGlobalTagRank } from "./ranking";

export type TagVoteValue = -1 | 1 | null;

function presentTagVote(value: number | null): TagVoteValue {
	if (value === null || value === -1 || value === 1) return value;
	throw new Error("Stored Tag vote has an invalid value");
}

const viewerUnitTagVote = alias(unitEffectiveTagVote, "viewer_unit_tag_vote");
const viewerRealmTagVote = alias(realmTagVote, "viewer_realm_tag_vote");
const globalTagUnit = alias(unit, "global_tag_unit");
const realmSourceUnit = alias(unit, "realm_tag_source_unit");
const voteContextRealmUnit = alias(unit, "realm_tag_vote_context_unit");
const votedTagUnit = alias(unit, "realm_voted_tag_unit");
const contextPostUnit = alias(unit, "realm_tag_context_post_unit");
const contextRealmUnit = alias(realmUnit, "realm_tag_context_realm_unit");
const unitTagWilsonConfidence = sql<number>`case
	when coalesce(${unitTagVoteStat.voteCount}, 0) = 0 then 0
	else (
		(
			(
				(coalesce(${unitTagVoteStat.voteCount}, 0)::numeric
					+ coalesce(${unitTagVoteStat.score}, 0)::numeric)
				/ (2 * coalesce(${unitTagVoteStat.voteCount}, 0)::numeric)
			)
			+ (1.96 * 1.96) / (2 * coalesce(${unitTagVoteStat.voteCount}, 0)::numeric)
			- 1.96 * sqrt(
				(
					(
						(
							(coalesce(${unitTagVoteStat.voteCount}, 0)::numeric
								+ coalesce(${unitTagVoteStat.score}, 0)::numeric)
							/ (2 * coalesce(${unitTagVoteStat.voteCount}, 0)::numeric)
						)
						* (
							1 - (
								(coalesce(${unitTagVoteStat.voteCount}, 0)::numeric
									+ coalesce(${unitTagVoteStat.score}, 0)::numeric)
								/ (2 * coalesce(${unitTagVoteStat.voteCount}, 0)::numeric)
							)
						)
						+ (1.96 * 1.96)
							/ (4 * coalesce(${unitTagVoteStat.voteCount}, 0)::numeric)
					)
					/ coalesce(${unitTagVoteStat.voteCount}, 0)::numeric
				)
			)
		)
		/ (
			1 + (1.96 * 1.96) / coalesce(${unitTagVoteStat.voteCount}, 0)::numeric
		)
	)
end`;

export async function listGlobalUnitTags(input: {
	readonly unitId: string;
	readonly viewerProfileId?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly limit: number;
	readonly excludedTagIds?: readonly string[];
}) {
	const rows = await database
		.select({
			tagId: unitEffectiveTag.tagId,
			language: resolvedUnitLocalizationLanguage(
				unitEffectiveTag.tagId,
				input.localizationLanguages,
			),
			title: resolvedUnitLocalizationTitle(
				unitEffectiveTag.tagId,
				input.localizationLanguages,
			),
			summary: resolvedUnitLocalizationSummary(
				unitEffectiveTag.tagId,
				input.localizationLanguages,
			),
			avatar: resolvedUnitLocalizationAvatar(
				unitEffectiveTag.tagId,
				input.localizationLanguages,
			),
			pinned: sql<boolean>`coalesce(${unitTag.pinned}, false)`,
			position: unitTag.position,
			score: unitTagVoteStat.score,
			voteCount: unitTagVoteStat.voteCount,
			viewerVote: viewerUnitTagVote.value,
			createdAt: unitEffectiveTag.createdAt,
			updatedAt: unitEffectiveTag.updatedAt,
		})
		.from(unitEffectiveTag)
		.innerJoin(tag, eq(tag.id, unitEffectiveTag.tagId))
		.innerJoin(globalTagUnit, eq(globalTagUnit.id, unitEffectiveTag.tagId))
		.leftJoin(
			unitTag,
			and(
				eq(unitTag.unitId, unitEffectiveTag.unitId),
				eq(unitTag.tagId, unitEffectiveTag.tagId),
			),
		)
		.leftJoin(
			unitTagVoteStat,
			and(
				eq(unitTagVoteStat.unitId, unitEffectiveTag.unitId),
				eq(unitTagVoteStat.tagId, unitEffectiveTag.tagId),
			),
		)
		.leftJoin(
			viewerUnitTagVote,
			and(
				eq(viewerUnitTagVote.unitId, unitEffectiveTag.unitId),
				eq(viewerUnitTagVote.tagId, unitEffectiveTag.tagId),
				input.viewerProfileId
					? eq(viewerUnitTagVote.profileId, input.viewerProfileId)
					: sql`false`,
			),
		)
		.where(
			and(
				eq(unitEffectiveTag.unitId, input.unitId),
				input.excludedTagIds?.length
					? notInArray(unitEffectiveTag.tagId, [...input.excludedTagIds])
					: undefined,
				getUnitReadCondition(input.viewerProfileId, {}, globalTagUnit),
			),
		)
		.orderBy(
			desc(sql`coalesce(${unitTag.pinned}, false)`),
			sql`case when ${unitTag.pinned} then ${unitTag.position} end asc nulls last`,
			desc(unitTagWilsonConfidence),
			desc(unitTagVoteStat.score),
			desc(unitTagVoteStat.voteCount),
			unitEffectiveTag.tagId,
		)
		.limit(input.limit);

	return rows.map((row) => ({
		...row,
		avatar: presentAvatar(row.avatar),
		score: toSafeInteger(row.score ?? 0n, "Unit Tag score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Unit Tag vote count"),
		viewerVote: presentTagVote(row.viewerVote),
	}));
}

export async function listRealmTagSubscriptions(input: {
	readonly profileId: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
}) {
	return database
		.select({
			realmId: profileRealmTagSubscription.realmId,
			language: resolvedUnitLocalizationLanguage(
				realmSourceUnit.id,
				input.localizationLanguages,
			),
			title: resolvedUnitLocalizationTitle(realmSourceUnit.id, input.localizationLanguages),
			summary: resolvedUnitLocalizationSummary(
				realmSourceUnit.id,
				input.localizationLanguages,
			),
			position: profileRealmTagSubscription.position,
			createdAt: profileRealmTagSubscription.createdAt,
			updatedAt: profileRealmTagSubscription.updatedAt,
		})
		.from(profileRealmTagSubscription)
		.innerJoin(realm, eq(realm.id, profileRealmTagSubscription.realmId))
		.innerJoin(realmSourceUnit, eq(realmSourceUnit.id, realm.id))
		.leftJoin(
			realmMember,
			and(
				eq(realmMember.realmId, profileRealmTagSubscription.realmId),
				eq(realmMember.profileId, input.profileId),
			),
		)
		.where(
			and(
				eq(profileRealmTagSubscription.profileId, input.profileId),
				or(
					getUnitReadCondition(input.profileId, {}, realmSourceUnit),
					and(
						eq(realmSourceUnit.status, "published"),
						eq(realmSourceUnit.visibility, "private"),
						eq(realmSourceUnit.moderationStatus, "approved"),
						isNull(realmSourceUnit.deletedAt),
						eq(realmMember.state, "active"),
					),
				),
			),
		)
		.orderBy(profileRealmTagSubscription.position, profileRealmTagSubscription.realmId);
}

export async function listRealmTagVoteContexts(input: {
	readonly profileId: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
}) {
	const rows = await database
		.select({
			realmId: realm.id,
			language: resolvedUnitLocalizationLanguage(
				voteContextRealmUnit.id,
				input.localizationLanguages,
			),
			title: resolvedUnitLocalizationTitle(
				voteContextRealmUnit.id,
				input.localizationLanguages,
			),
			summary: resolvedUnitLocalizationSummary(
				voteContextRealmUnit.id,
				input.localizationLanguages,
			),
			avatar: resolvedUnitLocalizationAvatar(
				voteContextRealmUnit.id,
				input.localizationLanguages,
			),
		})
		.from(realmMember)
		.innerJoin(realm, eq(realm.id, realmMember.realmId))
		.innerJoin(voteContextRealmUnit, eq(voteContextRealmUnit.id, realm.id))
		.leftJoin(
			profileRealmTagSubscription,
			and(
				eq(profileRealmTagSubscription.profileId, input.profileId),
				eq(profileRealmTagSubscription.realmId, realm.id),
			),
		)
		.where(
			and(
				eq(realmMember.profileId, input.profileId),
				eq(realmMember.state, "active"),
				getRealmContributionCondition(input.profileId, voteContextRealmUnit),
			),
		)
		.orderBy(sql`${profileRealmTagSubscription.position} asc nulls last`, realm.id);
	return rows.map((row) => ({
		...row,
		avatar: presentAvatar(row.avatar),
	}));
}

export async function upsertRealmTagSubscription(input: {
	readonly profileId: string;
	readonly realmId: string;
	readonly position?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
}) {
	await database
		.insert(profileRealmTagSubscription)
		.values({
			profileId: input.profileId,
			realmId: input.realmId,
			...(input.position === undefined ? {} : { position: input.position }),
		})
		.onConflictDoUpdate({
			target: [profileRealmTagSubscription.profileId, profileRealmTagSubscription.realmId],
			set: {
				...(input.position === undefined ? {} : { position: input.position }),
				updatedAt: new Date(),
			},
		});
	const subscriptions = await listRealmTagSubscriptions(input);
	const subscription = subscriptions.find(({ realmId }) => realmId === input.realmId);
	if (!subscription) throw new Error("Realm Tag subscription not found after upsert");
	return subscription;
}

export async function deleteRealmTagSubscription(
	profileId: string,
	realmId: string,
): Promise<void> {
	await database
		.delete(profileRealmTagSubscription)
		.where(
			and(
				eq(profileRealmTagSubscription.profileId, profileId),
				eq(profileRealmTagSubscription.realmId, realmId),
			),
		);
}

type RealmVotedTag = {
	readonly realmId: string;
	readonly tagId: string;
	readonly language: ContentLanguage | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: ReturnType<typeof presentAvatar>;
	readonly contextPostId: string | null;
	readonly score: number;
	readonly voteCount: number;
	readonly viewerVote: TagVoteValue;
	readonly createdAt: Date;
	readonly updatedAt: Date;
};

export async function listRealmVotedTags(input: {
	readonly unitId: string;
	readonly viewerProfileId: string;
	readonly realmIds: readonly string[];
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly perRealmLimit: number;
}) {
	if (input.realmIds.length === 0) return new Map<string, RealmVotedTag[]>();
	const contextIsReadable = sql<boolean>`
		${contextRealmUnit.status} = 'visible'
		and ${getUnitReadCondition(input.viewerProfileId, {}, contextPostUnit)}
	`;
	const rows = await database
		.select({
			realmId: realmTagVoteStat.realmId,
			tagId: realmTagVoteStat.tagId,
			language: resolvedUnitLocalizationLanguage(
				votedTagUnit.id,
				input.localizationLanguages,
			),
			title: resolvedUnitLocalizationTitle(votedTagUnit.id, input.localizationLanguages),
			summary: sql<string | null>`case
				when ${contextIsReadable}
				then ${resolvedUnitLocalizationSummary(contextPostUnit.id, input.localizationLanguages)}
				else null
			end`,
			avatar: resolvedUnitLocalizationAvatar(votedTagUnit.id, input.localizationLanguages),
			contextPostId: sql<string | null>`case
				when ${contextIsReadable} then ${realmTagContext.contextPostId}
				else null
			end`,
			score: realmTagVoteStat.score,
			voteCount: realmTagVoteStat.voteCount,
			viewerVote: viewerRealmTagVote.value,
			createdAt: sql<Date>`coalesce(${realmTagContext.createdAt}, ${realmTagVoteStat.updatedAt})`,
			updatedAt: sql<Date>`greatest(coalesce(${realmTagContext.updatedAt}, ${realmTagVoteStat.updatedAt}), ${realmTagVoteStat.updatedAt})`,
		})
		.from(realmTagVoteStat)
		.innerJoin(tag, eq(tag.id, realmTagVoteStat.tagId))
		.innerJoin(votedTagUnit, eq(votedTagUnit.id, realmTagVoteStat.tagId))
		.leftJoin(
			realmTagContext,
			and(
				eq(realmTagContext.realmId, realmTagVoteStat.realmId),
				eq(realmTagContext.tagId, realmTagVoteStat.tagId),
			),
		)
		.leftJoin(contextPostUnit, eq(contextPostUnit.id, realmTagContext.contextPostId))
		.leftJoin(
			contextRealmUnit,
			and(
				eq(contextRealmUnit.realmId, realmTagContext.realmId),
				eq(contextRealmUnit.unitId, realmTagContext.contextPostId),
			),
		)
		.leftJoin(
			viewerRealmTagVote,
			and(
				eq(viewerRealmTagVote.realmId, realmTagVoteStat.realmId),
				eq(viewerRealmTagVote.unitId, realmTagVoteStat.unitId),
				eq(viewerRealmTagVote.tagId, realmTagVoteStat.tagId),
				eq(viewerRealmTagVote.profileId, input.viewerProfileId),
			),
		)
		.where(
			and(
				eq(realmTagVoteStat.unitId, input.unitId),
				inArray(realmTagVoteStat.realmId, [...input.realmIds]),
				getUnitReadCondition(input.viewerProfileId, {}, votedTagUnit),
			),
		);

	const grouped = new Map<string, RealmVotedTag[]>();
	for (const row of rows) {
		const item = {
			...row,
			avatar: presentAvatar(row.avatar),
			score: toSafeInteger(row.score ?? 0n, "Realm Tag score"),
			voteCount: toSafeInteger(row.voteCount ?? 0n, "Realm Tag vote count"),
			viewerVote: presentTagVote(row.viewerVote),
		};
		const items = grouped.get(row.realmId) ?? [];
		items.push(item);
		grouped.set(row.realmId, items);
	}
	for (const [realmId, items] of grouped)
		grouped.set(
			realmId,
			items
				.toSorted((left, right) =>
					compareGlobalTagRank(
						{ ...left, pinned: false, position: null },
						{ ...right, pinned: false, position: null },
					),
				)
				.slice(0, input.perRealmLimit),
		);
	return grouped;
}

export async function getUnitTagLandscape(input: {
	readonly unitId: string;
	readonly viewerProfileId?: string;
	readonly localizationLanguages?: LocalizationLanguageQuery;
	readonly globalLimit: number;
	readonly includeStructures: boolean;
	readonly structureLimit: number;
	readonly sourceLimit: number;
	readonly perRealmLimit: number;
}) {
	if (!input.viewerProfileId) {
		const structures = input.includeStructures
			? await listVisibleUnitTagStructures({
					unitId: input.unitId,
					localizationLanguages: input.localizationLanguages,
					limit: input.structureLimit,
				})
			: [];
		return {
			structures,
			global: await listGlobalUnitTags({
				unitId: input.unitId,
				localizationLanguages: input.localizationLanguages,
				limit: input.globalLimit,
				excludedTagIds: structures.flatMap(({ members }) =>
					members.map(({ tagId }) => tagId),
				),
			}),
			realms: [],
			voteRealms: [],
		};
	}
	const [structures, allSubscriptions, voteRealms] = await Promise.all([
		input.includeStructures
			? listVisibleUnitTagStructures({
					unitId: input.unitId,
					viewerProfileId: input.viewerProfileId,
					localizationLanguages: input.localizationLanguages,
					limit: input.structureLimit,
				})
			: Promise.resolve([]),
		listRealmTagSubscriptions({
			profileId: input.viewerProfileId,
			localizationLanguages: input.localizationLanguages,
		}),
		listRealmTagVoteContexts({
			profileId: input.viewerProfileId,
			localizationLanguages: input.localizationLanguages,
		}),
	]);
	const global = await listGlobalUnitTags({
		unitId: input.unitId,
		viewerProfileId: input.viewerProfileId,
		localizationLanguages: input.localizationLanguages,
		limit: input.globalLimit,
		excludedTagIds: structures.flatMap(({ members }) => members.map(({ tagId }) => tagId)),
	});
	const realmIds = allSubscriptions.map(({ realmId }) => realmId);
	const votedTags = await listRealmVotedTags({
		unitId: input.unitId,
		viewerProfileId: input.viewerProfileId,
		realmIds,
		localizationLanguages: input.localizationLanguages,
		perRealmLimit: input.perRealmLimit,
	});
	return {
		structures,
		global,
		realms: selectRealmTagSources({
			sources: allSubscriptions,
			votedTags,
			canVoteRealmIds: new Set(voteRealms.map(({ realmId }) => realmId)),
			limit: input.sourceLimit,
		}),
		voteRealms,
	};
}
