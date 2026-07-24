import { and, desc, eq, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ContentLanguage } from "@rezics/i18n";

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
	realmUnitTag,
	tag,
	unit,
	unitEffectiveTag,
	unitEffectiveTagVote,
	unitTag,
	unitTagVoteStat,
} from "../database/schema";
import { listVisibleUnitTagStructures } from "../tag-structures/service";
import {
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { selectPopulatedRealmTagSources } from "./landscape";
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
const votedTagUnit = alias(unit, "realm_voted_tag_unit");
const policyTagUnit = alias(unit, "realm_policy_tag_unit");
const contextPostUnit = alias(unit, "realm_tag_context_post_unit");
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
	readonly language?: ContentLanguage;
	readonly limit: number;
	readonly excludedTagIds?: readonly string[];
}) {
	const rows = await database
		.select({
			tagId: unitEffectiveTag.tagId,
			title: resolvedUnitLocalizationTitle(unitEffectiveTag.tagId, input.language),
			summary: resolvedUnitLocalizationSummary(unitEffectiveTag.tagId, input.language),
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
		score: toSafeInteger(row.score ?? 0n, "Unit Tag score"),
		voteCount: toSafeInteger(row.voteCount ?? 0n, "Unit Tag vote count"),
		viewerVote: presentTagVote(row.viewerVote),
	}));
}

export async function listRealmTagSubscriptions(input: {
	readonly profileId: string;
	readonly language?: ContentLanguage;
}) {
	return database
		.select({
			realmId: profileRealmTagSubscription.realmId,
			title: resolvedUnitLocalizationTitle(realmSourceUnit.id, input.language),
			summary: resolvedUnitLocalizationSummary(realmSourceUnit.id, input.language),
			canVote: sql<boolean>`coalesce(${realmMember.state} = 'active', false)`,
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

export async function upsertRealmTagSubscription(input: {
	readonly profileId: string;
	readonly realmId: string;
	readonly position?: string;
	readonly language?: ContentLanguage;
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
	readonly title: string | null;
	readonly summary: string | null;
	readonly contextPostId: string;
	readonly score: number;
	readonly voteCount: number;
	readonly viewerVote: TagVoteValue;
	readonly createdAt: Date;
	readonly updatedAt: Date;
};

async function listRealmVotedTags(input: {
	readonly unitId: string;
	readonly viewerProfileId: string;
	readonly realmIds: readonly string[];
	readonly language?: ContentLanguage;
	readonly perRealmLimit: number;
}) {
	if (input.realmIds.length === 0) return new Map<string, RealmVotedTag[]>();
	const rows = await database
		.select({
			realmId: realmTagContext.realmId,
			tagId: realmTagContext.tagId,
			title: resolvedUnitLocalizationTitle(votedTagUnit.id, input.language),
			summary: resolvedUnitLocalizationSummary(votedTagUnit.id, input.language),
			contextPostId: realmTagContext.contextPostId,
			score: realmTagVoteStat.score,
			voteCount: realmTagVoteStat.voteCount,
			viewerVote: viewerRealmTagVote.value,
			createdAt: realmTagContext.createdAt,
			updatedAt: realmTagContext.updatedAt,
		})
		.from(realmTagContext)
		.innerJoin(tag, eq(tag.id, realmTagContext.tagId))
		.innerJoin(votedTagUnit, eq(votedTagUnit.id, realmTagContext.tagId))
		.innerJoin(contextPostUnit, eq(contextPostUnit.id, realmTagContext.contextPostId))
		.leftJoin(
			realmTagVoteStat,
			and(
				eq(realmTagVoteStat.realmId, realmTagContext.realmId),
				eq(realmTagVoteStat.unitId, realmTagContext.unitId),
				eq(realmTagVoteStat.tagId, realmTagContext.tagId),
			),
		)
		.leftJoin(
			viewerRealmTagVote,
			and(
				eq(viewerRealmTagVote.realmId, realmTagContext.realmId),
				eq(viewerRealmTagVote.unitId, realmTagContext.unitId),
				eq(viewerRealmTagVote.tagId, realmTagContext.tagId),
				eq(viewerRealmTagVote.profileId, input.viewerProfileId),
			),
		)
		.where(
			and(
				eq(realmTagContext.unitId, input.unitId),
				inArray(realmTagContext.realmId, [...input.realmIds]),
				getUnitReadCondition(input.viewerProfileId, {}, votedTagUnit),
				getUnitReadCondition(input.viewerProfileId, {}, contextPostUnit),
			),
		);

	const grouped = new Map<string, RealmVotedTag[]>();
	for (const row of rows) {
		const item = {
			...row,
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

async function listRealmPolicyTags(input: {
	readonly unitId: string;
	readonly viewerProfileId: string;
	readonly realmIds: readonly string[];
	readonly language?: ContentLanguage;
	readonly perRealmLimit: number;
}) {
	if (input.realmIds.length === 0) return new Map<string, RealmPolicyTag[]>();
	const rows = await database
		.select({
			realmId: realmUnitTag.realmId,
			tagId: realmUnitTag.tagId,
			title: resolvedUnitLocalizationTitle(policyTagUnit.id, input.language),
			summary: resolvedUnitLocalizationSummary(policyTagUnit.id, input.language),
			position: realmUnitTag.position,
			createdAt: realmUnitTag.createdAt,
			updatedAt: realmUnitTag.updatedAt,
		})
		.from(realmUnitTag)
		.innerJoin(tag, eq(tag.id, realmUnitTag.tagId))
		.innerJoin(policyTagUnit, eq(policyTagUnit.id, realmUnitTag.tagId))
		.where(
			and(
				eq(realmUnitTag.unitId, input.unitId),
				inArray(realmUnitTag.realmId, [...input.realmIds]),
				getUnitReadCondition(input.viewerProfileId, {}, policyTagUnit),
			),
		)
		.orderBy(realmUnitTag.realmId, realmUnitTag.position, realmUnitTag.tagId);
	const grouped = new Map<string, RealmPolicyTag[]>();
	for (const row of rows) {
		const items = grouped.get(row.realmId) ?? [];
		if (items.length < input.perRealmLimit) items.push(row);
		grouped.set(row.realmId, items);
	}
	return grouped;
}

type RealmPolicyTag = {
	readonly realmId: string;
	readonly tagId: string;
	readonly title: string | null;
	readonly summary: string | null;
	readonly position: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
};

export async function getUnitTagLandscape(input: {
	readonly unitId: string;
	readonly viewerProfileId?: string;
	readonly language?: ContentLanguage;
	readonly globalLimit: number;
	readonly structureLimit: number;
	readonly sourceLimit: number;
	readonly perRealmLimit: number;
}) {
	if (!input.viewerProfileId) {
		const structures = await listVisibleUnitTagStructures({
			unitId: input.unitId,
			language: input.language,
			limit: input.structureLimit,
		});
		return {
			structures,
			global: await listGlobalUnitTags({
				unitId: input.unitId,
				language: input.language,
				limit: input.globalLimit,
				excludedTagIds: structures.flatMap(({ members }) =>
					members.map(({ tagId }) => tagId),
				),
			}),
			realms: [],
		};
	}
	const [structures, allSubscriptions] = await Promise.all([
		listVisibleUnitTagStructures({
			unitId: input.unitId,
			viewerProfileId: input.viewerProfileId,
			language: input.language,
			limit: input.structureLimit,
		}),
		listRealmTagSubscriptions({
			profileId: input.viewerProfileId,
			language: input.language,
		}),
	]);
	const global = await listGlobalUnitTags({
		unitId: input.unitId,
		viewerProfileId: input.viewerProfileId,
		language: input.language,
		limit: input.globalLimit,
		excludedTagIds: structures.flatMap(({ members }) => members.map(({ tagId }) => tagId)),
	});
	const realmIds = allSubscriptions.map(({ realmId }) => realmId);
	const [votedTags, policyTags] = await Promise.all([
		listRealmVotedTags({
			unitId: input.unitId,
			viewerProfileId: input.viewerProfileId,
			realmIds,
			language: input.language,
			perRealmLimit: input.perRealmLimit,
		}),
		listRealmPolicyTags({
			unitId: input.unitId,
			viewerProfileId: input.viewerProfileId,
			realmIds,
			language: input.language,
			perRealmLimit: input.perRealmLimit,
		}),
	]);
	return {
		structures,
		global,
		realms: selectPopulatedRealmTagSources({
			sources: allSubscriptions,
			votedTags,
			policyTags,
			limit: input.sourceLimit,
		}),
	};
}
