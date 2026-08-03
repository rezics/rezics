import { createHash } from "node:crypto";
import { StatusCodes } from "http-status-codes";
import { and, asc, desc, eq, exists, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia, { t } from "elysia";
import type { PresentedAvatar } from "@rezics/avatar";
import {
	assertUnitFilter,
	canonicalUnitFilter,
	FilterSchemaModels,
	readSimpleFeedContentKinds,
	readSimpleFeedFilter,
	readUnitLanguageBoundary,
	type SearchCategory,
	type UnitPredicate,
} from "@rezics/filter";
import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import { OfficialRealmUnitIds } from "@rezics/slug";

import { resolveIdentity } from "../../auth/session";
import { getProfileActivityReadCondition } from "../../authorization/profile-activity/query";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
} from "../../units/localization";
import {
	post,
	postScore,
	postReply,
	postReplyStat,
	profilePreference,
	score,
	scoreStat,
	collectionItem,
	unitFollow,
	realmMember,
	realmTagContext,
	realmUnit,
	recommendationProfileInterest,
	recommendationUnitEdge,
	recommendationUnitStat,
	unit,
	unitLocalization,
	unitReaction,
	unitReactionGlobalStat,
	unitRevisionHead,
	unitStructureMember,
} from "../../database/schema";
import { parseJsonCursor } from "../../pagination";
import {
	fallbackRecommendationSnapshot,
	resolveRecommendationSnapshot,
	resolveRecommendationViewer,
	type RecommendationViewer,
} from "../../recommendations/context";
import { RecommendationPolicy } from "../../recommendations/policy";
import {
	EmptyRecommendationStats,
	rankRecommendations,
	type RecommendationCandidate,
	type RecommendationStats,
} from "../../recommendations/ranking";
import { recommendationObjectiveExpression } from "../../recommendations/sql-ranking";
import { createRecommendationTracking } from "../../recommendations/tracking";
import { presentAvatar } from "../../units/avatar";
import { presentImageAsset } from "../../units/service";
import { compileUnitPredicateSql } from "../../filter/sql";
import { InvalidSearch, SearchUnavailable } from "../../search/errors";
import { SearchCategories } from "../../search/schema";
import { searchDomain } from "../../search/service";
import {
	getPublicCanonicalUnitSlugAddresses,
	type PublicCanonicalUnitSlugAddress,
} from "../../units/slug-address";
import { getAttributionSummariesByUnitIds } from "../../units/attribution";
import {
	RecommendationPolicyVersionSchema,
	type RecommendationReason,
	type RecommendationSurface,
} from "../recommendations/schema";
import {
	toApiErrorResponse,
	FeedResponse,
	toPortableTextResponse,
	type FeedItemResponseValue,
} from "../schema/response";
import { InvalidFeedCursor, InvalidFeedFilter } from "./errors";
import {
	DefaultFeedContentKindValues,
	type FeedContentKind,
	FeedContentKindValues,
	type FeedPostKind,
	FeedPostKindValues,
	FeedRequest,
	FeedRatedWorkUnitKindValues,
	FeedSortSchema,
	type FeedUnitKind,
	FeedUnitKindValues,
	type FeedRequest as FeedRequestType,
	type FeedSort,
} from "./schema";

const preferredLocalization = alias(unitLocalization, "preferred_localization");
const feedContextRealm = alias(unit, "feed_context_realm");
const feedReviewScoreTargetUnit = alias(unit, "feed_review_score_target_unit");
const feedReviewScoreRealm = alias(unit, "feed_review_score_realm");
const feedRealmContextTagUnit = alias(unit, "feed_realm_context_tag_unit");
const feedRealmContextPostUnit = alias(unit, "feed_realm_context_post_unit");

interface FeedRealmContextSummary {
	readonly id: string;
	readonly language: ContentLanguage;
	readonly slugAddress: PublicCanonicalUnitSlugAddress | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: PresentedAvatar | null;
}

async function getFeedRealmContextsByUnitIds(
	unitIds: readonly string[],
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<Map<string, FeedRealmContextSummary[]>> {
	const result = new Map<string, FeedRealmContextSummary[]>();
	for (const unitId of unitIds) result.set(unitId, []);
	if (!unitIds.length) return result;
	const rows = await database
		.select({
			unitId: realmUnit.unitId,
			id: realmUnit.realmId,
			language: resolvedUnitLocalizationLanguage(feedContextRealm.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(feedContextRealm.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(feedContextRealm.id, localizationLanguages),
			avatar: resolvedUnitLocalizationAvatar(feedContextRealm.id, localizationLanguages),
		})
		.from(realmUnit)
		.innerJoin(feedContextRealm, eq(feedContextRealm.id, realmUnit.realmId))
		.where(
			and(
				inArray(realmUnit.unitId, [...unitIds]),
				eq(realmUnit.status, "visible"),
				eq(realmUnit.publicationState, "active"),
				eq(feedContextRealm.status, "published"),
				eq(feedContextRealm.visibility, "public"),
				isNull(feedContextRealm.deletedAt),
			),
		)
		.orderBy(asc(realmUnit.createdAt), asc(realmUnit.realmId));
	const slugAddresses = await getPublicCanonicalUnitSlugAddresses(rows.map((row) => row.id));
	for (const row of rows) {
		if (!row.language) continue;
		result.get(row.unitId)?.push({
			id: row.id,
			language: row.language,
			slugAddress: slugAddresses.get(row.id) ?? null,
			title: row.title,
			summary: row.summary,
			avatar: presentAvatar(row.avatar),
		});
	}
	return result;
}

export function prioritizeFeedRealmContexts<T extends { readonly id: string }>(
	realms: readonly T[],
	primaryRealmId: string | null,
): T[] {
	if (!primaryRealmId) return [...realms];
	const primary = realms.find((realm) => realm.id === primaryRealmId);
	return primary
		? [primary, ...realms.filter((realm) => realm.id !== primaryRealmId)]
		: [...realms];
}

type FeedContentDefinition =
	| { readonly itemType: "unit"; readonly unitKind: FeedUnitKind }
	| { readonly itemType: "post"; readonly postKind: FeedPostKind };

const FeedContentDefinitions = {
	"unit:profile": { itemType: "unit", unitKind: "profile" },
	"unit:book": { itemType: "unit", unitKind: "book" },
	"unit:software": { itemType: "unit", unitKind: "software" },
	"unit:media": { itemType: "unit", unitKind: "media" },
	"unit:release": { itemType: "unit", unitKind: "release" },
	"unit:entity": { itemType: "unit", unitKind: "entity" },
	"unit:tag": { itemType: "unit", unitKind: "tag" },
	"unit:structure": { itemType: "unit", unitKind: "structure" },
	"unit:series": { itemType: "unit", unitKind: "series" },
	"unit:zone": { itemType: "unit", unitKind: "zone" },
	"unit:collection": { itemType: "unit", unitKind: "collection" },
	"unit:poll": { itemType: "unit", unitKind: "poll" },
	"unit:realm": { itemType: "unit", unitKind: "realm" },
	"post:post": { itemType: "post", postKind: "post" },
	"post:reply": { itemType: "post", postKind: "reply" },
	"post:excerpt": { itemType: "post", postKind: "excerpt" },
	"post:review": { itemType: "post", postKind: "review" },
	"post:chapter": { itemType: "post", postKind: "chapter" },
	"post:wiki": { itemType: "post", postKind: "wiki" },
	"post:picture": { itemType: "post", postKind: "picture" },
} as const satisfies Record<FeedContentKind, FeedContentDefinition>;

const FeedUnitKinds: ReadonlySet<string> = new Set(FeedUnitKindValues);
const FeedPostKinds: ReadonlySet<string> = new Set(FeedPostKindValues);
const FeedRatedWorkUnitKinds: ReadonlySet<string> = new Set(FeedRatedWorkUnitKindValues);

function isFeedUnitKind(value: string): value is FeedUnitKind {
	return FeedUnitKinds.has(value);
}

function isFeedPostKind(value: string | null): value is FeedPostKind {
	return value !== null && FeedPostKinds.has(value);
}

function isFeedRatedWorkUnitKind(
	value: FeedUnitKind,
): value is (typeof FeedRatedWorkUnitKindValues)[number] {
	return FeedRatedWorkUnitKinds.has(value);
}

interface FeedScoreAggregate {
	readonly realmId: string;
	readonly totalScore: number;
	readonly totalCount: number;
}

export function createFeedScoreCandidates({
	aggregates,
	realmTitles,
	defaultRealmId,
	globalRealmId,
	targetId,
}: {
	readonly aggregates: ReadonlyMap<string, FeedScoreAggregate>;
	readonly realmTitles: ReadonlyMap<string, string | null>;
	readonly defaultRealmId: string;
	readonly globalRealmId: string;
	readonly targetId: string;
}) {
	const present = (realmId: string) => {
		const aggregate = aggregates.get(`${targetId}:${realmId}`);
		return aggregate
			? {
					...aggregate,
					realmTitle: realmTitles.get(aggregate.realmId) ?? null,
				}
			: null;
	};
	return {
		preferred: present(defaultRealmId),
		global: present(globalRealmId),
	};
}

export function resolveFeedContentSelection(content?: readonly FeedContentKind[]) {
	const requested = new Set(content ?? DefaultFeedContentKindValues);
	const selected = FeedContentKindValues.filter((kind) => requested.has(kind));
	const unitKinds: FeedUnitKind[] = [];
	const postKinds: FeedPostKind[] = [];
	for (const kind of selected) {
		const definition = FeedContentDefinitions[kind];
		if (definition.itemType === "unit") unitKinds.push(definition.unitKind);
		else postKinds.push(definition.postKind);
	}
	return { selected: [...selected], unitKinds, postKinds } as const;
}

const FeedSearchCategoryByContentKind = {
	"unit:profile": "users",
	"unit:book": "units",
	"unit:software": "units",
	"unit:media": "units",
	"unit:release": "units",
	"unit:entity": "entities",
	"unit:tag": "tags",
	"unit:structure": "tag-structures",
	"unit:series": "units",
	"unit:zone": "units",
	"unit:collection": "collections",
	"unit:poll": "polls",
	"unit:realm": "realms",
	"post:post": "posts",
	"post:reply": "posts",
	"post:excerpt": "posts",
	"post:review": "reviews",
	"post:chapter": "posts",
	"post:wiki": "posts",
	"post:picture": "posts",
} as const satisfies Record<FeedContentKind, SearchCategory>;

export function resolveFeedSearchCategories(
	content?: readonly FeedContentKind[],
): SearchCategory[] {
	const requested = new Set(
		resolveFeedContentSelection(content).selected.map(
			(kind) => FeedSearchCategoryByContentKind[kind],
		),
	);
	return SearchCategories.filter((category) => requested.has(category));
}

interface FeedSearchSelection {
	readonly ids: readonly string[];
	readonly relation: "exact" | "lower-bound";
}

type FeedTotalRelation = FeedSearchSelection["relation"];
type FeedCandidateCoverage = "bounded" | "exhaustive";

async function resolveFeedSearchSelection(input: {
	readonly content?: readonly FeedContentKind[];
	readonly filter: UnitPredicate | undefined;
	readonly profileId: string | undefined;
	readonly query: string;
}): Promise<FeedSearchSelection> {
	const categories = resolveFeedSearchCategories(input.content);
	const pageSize = Math.max(
		1,
		Math.floor(RecommendationPolicy.maxCandidates / categories.length),
	);
	const groups = await Promise.all(
		categories.map((category) =>
			searchDomain(category, {
				...(input.filter ? { domainFilter: input.filter } : {}),
				...(input.profileId ? { profileId: input.profileId } : {}),
				query: input.query,
				limit: pageSize,
				sort: "best",
			}),
		),
	);
	return {
		ids: [...new Set(groups.flatMap((group) => group.hits.map((hit) => hit.id)))],
		relation: groups.every((group) => group.total.relation === "exact")
			? "exact"
			: "lower-bound",
	};
}

interface FeedEligibilityBaseScope {
	readonly content?: readonly FeedContentKind[];
	readonly languages?: readonly ContentLanguage[];
	readonly localizationLanguages?: readonly ContentLanguage[];
	readonly realmIds?: readonly string[];
	readonly subjectId?: string;
	readonly filter?: UnitPredicate;
	readonly searchCandidateIds?: readonly string[];
	readonly reviewScore?: never;
}

interface FeedReviewEligibilityScope extends Omit<
	FeedEligibilityBaseScope,
	"content" | "reviewScore"
> {
	readonly content: readonly ["post:review"];
	readonly reviewScore: Readonly<{
		realmId: string;
		values: readonly number[];
	}>;
}

/**
 * Internal product flows may narrow Feed eligibility beyond the deliberately
 * small public Feed query.
 */
export type FeedEligibilityScope = FeedEligibilityBaseScope | FeedReviewEligibilityScope;

/** Resolves a caller override or the authenticated viewer's canonical presentation priority. */
export function resolveFeedLocalizationLanguages(
	requestedLanguages: readonly ContentLanguage[] | undefined,
	viewer: Pick<RecommendationViewer, "preferredLanguages">,
): readonly ContentLanguage[] {
	return requestedLanguages?.length ? requestedLanguages : viewer.preferredLanguages;
}

const FeedCursor = t.Object(
	{
		v: t.Literal(9),
		sort: FeedSortSchema,
		filterHash: t.Nullable(t.String({ pattern: "^[0-9a-f]{64}$" })),
		filterLanguages: t.Array(t.UnionEnum(ContentLanguageValues), { uniqueItems: true }),
		localizationLanguages: t.Array(t.UnionEnum(ContentLanguageValues), {
			uniqueItems: true,
		}),
		personalized: t.Boolean(),
		snapshotId: t.Nullable(t.String({ format: "uuid" })),
		policyVersion: RecommendationPolicyVersionSchema,
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		asOf: t.String({ format: "date-time" }),
		lastId: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);
type FeedCursor = typeof FeedCursor.static;

function decodeCursor(value: string | undefined) {
	if (!value) return undefined;
	try {
		return parseJsonCursor(value, FeedCursor);
	} catch {
		throw new InvalidFeedCursor();
	}
}

function validateCursor(
	cursor: FeedCursor | undefined,
	query: FeedRequestType,
	personalized: boolean,
	filterLanguages: readonly ContentLanguage[],
	localizationLanguages: readonly ContentLanguage[],
) {
	if (!cursor) return;
	const filterHash = query.filter
		? createHash("sha256").update(canonicalUnitFilter(query.filter)).digest("hex")
		: null;
	if (
		cursor.sort !== (query.sort ?? "best") ||
		cursor.filterHash !== filterHash ||
		cursor.filterLanguages.length !== filterLanguages.length ||
		cursor.filterLanguages.some((language, index) => language !== filterLanguages[index]) ||
		cursor.localizationLanguages.length !== localizationLanguages.length ||
		cursor.localizationLanguages.some(
			(language, index) => language !== localizationLanguages[index],
		) ||
		cursor.personalized !== personalized ||
		cursor.limit !== (query.limit ?? 20) ||
		Number.isNaN(Date.parse(cursor.asOf))
	)
		throw new InvalidFeedCursor();
}

export function getFeedEligibilityCondition(
	viewer: Pick<
		RecommendationViewer,
		"contentRatings" | "personalized" | "preferredLanguages" | "profileId"
	>,
	scope: FeedEligibilityScope,
	asOf: Date,
	anchorId?: string,
): SQL {
	const { unitKinds, postKinds } = resolveFeedContentSelection(scope.content);
	const contentCondition = or(
		unitKinds.length ? inArray(unit.kind, unitKinds) : undefined,
		postKinds.length ? and(eq(unit.kind, "post"), inArray(post.kind, postKinds)) : undefined,
	);
	return and(
		contentCondition,
		eq(unit.status, "published"),
		eq(unit.visibility, "public"),
		eq(unit.moderationStatus, "approved"),
		isNull(unit.deletedAt),
		lte(unit.createdAt, asOf),
		sql`(${unit.kind} <> 'post' or ${post.kind} <> 'reply'::post_kind or exists (
			select 1 from post_reply readable_reply
			join unit readable_root on readable_root.id = readable_reply.root_post_id
			where readable_reply.post_id = ${post.id}
				and readable_root.status = 'published'
				and readable_root.visibility = 'public'
				and readable_root.moderation_status = 'approved'
				and readable_root.deleted_at is null
		))`,
		scope.languages?.length
			? sql`exists (
				select 1 from unit_localization scoped_localization
				where scoped_localization.unit_id = ${unit.id}
					and scoped_localization.language in (${sql.join(
						scope.languages.map((language) => sql`${language}`),
						sql`, `,
					)})
			)`
			: undefined,
		scope.realmIds?.length
			? sql`exists (
				select 1 from realm_unit scoped_content
				where scoped_content.unit_id = ${unit.id}
					and scoped_content.realm_id in (${sql.join(
						scope.realmIds.map((realmId) => sql`${realmId}::uuid`),
						sql`, `,
					)})
					and scoped_content.status = 'visible'
					and scoped_content.publication_state = 'active'
			)`
			: undefined,
		scope.subjectId ? eq(post.subjectUnitId, scope.subjectId) : undefined,
		scope.reviewScore
			? exists(
					database
						.select({ scoreId: score.id })
						.from(postScore)
						.innerJoin(score, eq(score.id, postScore.scoreId))
						.innerJoin(
							profilePreference,
							eq(profilePreference.profileId, score.profileId),
						)
						.innerJoin(
							feedReviewScoreTargetUnit,
							eq(feedReviewScoreTargetUnit.id, score.unitId),
						)
						.innerJoin(feedReviewScoreRealm, eq(feedReviewScoreRealm.id, score.realmId))
						.where(
							and(
								eq(postScore.postId, post.id),
								eq(score.realmId, scope.reviewScore.realmId),
								inArray(score.value, scope.reviewScore.values),
								getProfileActivityReadCondition({
									ownerProfileId: score.profileId,
									categoryVisibility: profilePreference.scoreVisibility,
									itemVisibility: score.visibility,
									viewerProfileId: viewer.profileId,
									surface: "linked",
								}),
								getUnitReadCondition(
									viewer.profileId,
									{},
									feedReviewScoreTargetUnit,
								),
								getUnitReadCondition(viewer.profileId, {}, feedReviewScoreRealm),
							),
						),
				)
			: undefined,
		scope.filter
			? compileUnitPredicateSql(scope.filter, {
					unitId: sql`${unit.id}`,
					unitKind: sql`${unit.kind}`,
					...(viewer.profileId ? { viewerProfileId: viewer.profileId } : {}),
				})
			: undefined,
		scope.searchCandidateIds
			? scope.searchCandidateIds.length
				? inArray(unit.id, [...scope.searchCandidateIds])
				: sql`false`
			: undefined,
		viewer.contentRatings.length
			? inArray(unit.contentRating, viewer.contentRatings)
			: undefined,
		viewer.profileId
			? sql`not exists (
				select 1 from credit_attribution attribution
				join profile_block blocked on
					(blocked.blocker_profile_id = ${viewer.profileId}::uuid and blocked.blocked_profile_id = attribution.credited_unit_id)
					or (blocked.blocker_profile_id = attribution.credited_unit_id and blocked.blocked_profile_id = ${viewer.profileId}::uuid)
				where attribution.source_unit_id = ${unit.id}
			)`
			: undefined,
		viewer.profileId
			? sql`(${unit.id} = ${anchorId ?? null}::uuid or not exists (
				select 1 from recommendation_exclusion excluded
				where excluded.profile_id = ${viewer.profileId}::uuid and excluded.unit_id = ${unit.id}
			))`
			: undefined,
	)!;
}

export interface CandidateSources {
	ids: string[];
	relevance: Map<string, number>;
	reason: Map<string, RecommendationReason>;
}

interface FeedCandidateSourceWindow extends CandidateSources {
	readonly coverage: FeedCandidateCoverage;
}

/** @internal Resolves rows returned by a `limit + 1` exhaustion probe. */
export function resolveFeedCandidateWindow<T>(
	rows: readonly T[],
	limit: number,
): Readonly<{ rows: readonly T[]; coverage: FeedCandidateCoverage }> {
	if (!Number.isSafeInteger(limit) || limit < 1)
		throw new RangeError("Feed candidate limit must be a positive safe integer");
	return {
		rows: rows.slice(0, limit),
		coverage: rows.length > limit ? "bounded" : "exhaustive",
	};
}

/** @internal Creates a Feed total from candidates whose eligibility has already been verified. */
export function createFeedTotal(input: {
	readonly candidates: readonly unknown[];
	readonly coverage: FeedCandidateCoverage;
	readonly searchRelation: FeedTotalRelation;
}): Readonly<{ value: number; relation: FeedTotalRelation }> {
	return {
		value: input.candidates.length,
		relation:
			input.coverage === "exhaustive" && input.searchRelation === "exact"
				? "exact"
				: "lower-bound",
	};
}

type CandidateReason =
	CandidateSources["reason"] extends Map<string, infer Reason> ? Reason : never;

async function getCandidateSources(input: {
	viewer: RecommendationViewer;
	query: FeedEligibilityScope;
	sort: FeedSort;
	snapshotId: string | null;
	asOf: Date;
	anchorId?: string;
}): Promise<FeedCandidateSourceWindow> {
	const condition = getFeedEligibilityCondition(
		input.viewer,
		input.query,
		input.asOf,
		input.anchorId,
	);
	const snapshotJoin = input.snapshotId
		? and(
				eq(recommendationUnitStat.snapshotId, input.snapshotId),
				eq(recommendationUnitStat.unitId, unit.id),
				isNull(recommendationUnitStat.contextRealmId),
			)
		: sql`false`;
	const objective = recommendationObjectiveExpression(input.sort, input.asOf);
	const objectiveLimit = input.viewer.personalized
		? RecommendationPolicy.maxObjectiveCandidates
		: RecommendationPolicy.maxCandidates - RecommendationPolicy.maxExplorationCandidates;
	const objectivePromise = database
		.select({
			id: unit.id,
			engagement6h: recommendationUnitStat.engagement6h,
			engagement24h: recommendationUnitStat.engagement24h,
		})
		.from(unit)
		.leftJoin(post, eq(post.id, unit.id))
		.leftJoin(recommendationUnitStat, snapshotJoin)
		.where(condition)
		.orderBy(desc(objective), desc(unit.createdAt), desc(unit.id))
		.limit(objectiveLimit + 1);
	const recentPromise = database
		.select({ id: unit.id })
		.from(unit)
		.leftJoin(post, eq(post.id, unit.id))
		.where(condition)
		.orderBy(desc(unit.createdAt), desc(unit.id))
		.limit(RecommendationPolicy.maxExplorationCandidates);
	const graphScore = sql<number>`sum(${recommendationProfileInterest.weight} * ${recommendationUnitEdge.score})`;
	const graphPromise =
		input.viewer.personalized && input.viewer.profileId && input.snapshotId
			? database
					.select({ id: recommendationUnitEdge.targetUnitId, score: graphScore })
					.from(recommendationProfileInterest)
					.innerJoin(
						recommendationUnitEdge,
						and(
							eq(
								recommendationUnitEdge.snapshotId,
								recommendationProfileInterest.snapshotId,
							),
							eq(
								recommendationUnitEdge.sourceUnitId,
								recommendationProfileInterest.unitId,
							),
						),
					)
					.innerJoin(unit, eq(unit.id, recommendationUnitEdge.targetUnitId))
					.leftJoin(post, eq(post.id, unit.id))
					.where(
						and(
							eq(recommendationProfileInterest.snapshotId, input.snapshotId),
							eq(recommendationProfileInterest.profileId, input.viewer.profileId),
							condition,
						),
					)
					.groupBy(recommendationUnitEdge.targetUnitId)
					.orderBy(desc(graphScore), desc(recommendationUnitEdge.targetUnitId))
					.limit(RecommendationPolicy.maxGraphCandidates)
			: Promise.resolve([]);
	const followedPromise =
		input.viewer.personalized && input.viewer.profileId
			? database
					.selectDistinct({ id: unit.id, createdAt: unit.createdAt })
					.from(unit)
					.leftJoin(post, eq(post.id, unit.id))
					.innerJoin(
						unitFollow,
						and(
							eq(unitFollow.followerProfileId, input.viewer.profileId),
							or(
								eq(unitFollow.unitId, unit.id),
								sql`exists (
									select 1 from credit_attribution followed_attribution
									where followed_attribution.source_unit_id = ${unit.id}
										and followed_attribution.credited_unit_id = ${unitFollow.unitId}
								)`,
							),
						),
					)
					.where(condition)
					.orderBy(desc(unit.createdAt), desc(unit.id))
					.limit(RecommendationPolicy.maxFollowCandidates)
			: Promise.resolve([]);
	const realmPromise =
		input.viewer.personalized && input.viewer.profileId
			? database
					.selectDistinct({ id: unit.id, createdAt: unit.createdAt })
					.from(unit)
					.leftJoin(post, eq(post.id, unit.id))
					.innerJoin(
						realmUnit,
						and(
							eq(realmUnit.unitId, unit.id),
							eq(realmUnit.status, "visible"),
							eq(realmUnit.publicationState, "active"),
						),
					)
					.innerJoin(
						unitFollow,
						and(
							eq(unitFollow.followerProfileId, input.viewer.profileId),
							eq(unitFollow.unitId, realmUnit.realmId),
						),
					)
					.where(condition)
					.orderBy(desc(unit.createdAt), desc(unit.id))
					.limit(RecommendationPolicy.maxFollowCandidates)
			: Promise.resolve([]);

	const [objectiveProbeRows, recentRows, graphRows, followedRows, realmRows] = await Promise.all([
		objectivePromise,
		recentPromise,
		graphPromise,
		followedPromise,
		realmPromise,
	]);
	const objectiveWindow = resolveFeedCandidateWindow(objectiveProbeRows, objectiveLimit);
	const objectiveRows = objectiveWindow.rows;
	const relevance = new Map<string, number>();
	const reason = new Map<string, CandidateReason>();
	const addRanked = (
		rows: readonly { id: string }[],
		weight: number,
		nextReason: "followed_unit" | "followed_realm" | "based_on_activity",
	) => {
		rows.forEach(({ id }, index) => {
			relevance.set(id, (relevance.get(id) ?? 0) + weight / (60 + index + 1));
			if (!reason.has(id)) reason.set(id, nextReason);
		});
	};
	addRanked(followedRows, 4, "followed_unit");
	addRanked(realmRows, 4, "followed_realm");
	addRanked(graphRows, 4, "based_on_activity");
	for (const row of objectiveRows) {
		if (reason.has(row.id)) continue;
		if (input.sort === "new") {
			reason.set(row.id, "new_and_relevant");
			continue;
		}
		const popular =
			input.sort === "rising"
				? toNumber(row.engagement6h) > 0
				: toNumber(row.engagement24h) > 0;
		if (popular) reason.set(row.id, "popular_now");
	}
	for (const { id } of recentRows) if (!reason.has(id)) reason.set(id, "new_and_relevant");
	const personalIds = [...relevance.entries()]
		.sort((left, right) => right[1] - left[1] || right[0].localeCompare(left[0]))
		.slice(
			0,
			RecommendationPolicy.maxGraphCandidates + RecommendationPolicy.maxFollowCandidates,
		)
		.map(([id]) => id);
	return {
		ids: [
			...new Set([
				...personalIds,
				...objectiveRows.map(({ id }) => id),
				...recentRows.map(({ id }) => id),
			]),
		].slice(0, RecommendationPolicy.maxCandidates),
		coverage: objectiveWindow.coverage,
		relevance,
		reason,
	};
}

export interface FeedRankingCandidate extends RecommendationCandidate {
	unitKind: FeedUnitKind | "post";
	postKind: FeedPostKind | null;
	creditedUnitIds: readonly string[];
	realmId: string | null;
	subjectId: string | null;
	rootPostId: string | null;
	parentPostId: string | null;
}

function toNumber(value: number | null | undefined) {
	return Number(value ?? 0);
}

function toCount(value: bigint | null | undefined, name: string) {
	return toSafeInteger(value ?? 0n, name);
}

export function getFeedCandidateRealmIdExpression(
	viewer: Pick<RecommendationViewer, "personalized" | "profileId">,
	realmIds?: readonly string[],
): SQL<string | null> {
	const followedRealmOrder =
		viewer.personalized && viewer.profileId
			? sql`case when exists (
				select 1 from ${unitFollow}
				where ${unitFollow.followerProfileId} = ${viewer.profileId}::uuid
					and ${unitFollow.unitId} = candidate_realm.realm_id
			) then 0 else 1 end,`
			: sql``;
	return sql<string | null>`(
		select candidate_realm.realm_id from realm_unit candidate_realm
		where candidate_realm.unit_id = ${unit.id}
			and candidate_realm.status = 'visible'
			and candidate_realm.publication_state = 'active'
			${
				realmIds?.length
					? sql`and candidate_realm.realm_id in (${sql.join(
							realmIds.map((realmId) => sql`${realmId}::uuid`),
							sql`, `,
						)})`
					: sql``
			}
		order by
			${followedRealmOrder}
			candidate_realm.created_at desc, candidate_realm.realm_id
		limit 1
	)`;
}

export async function getFeedRankingCandidates(input: {
	ids: string[];
	sources: CandidateSources;
	viewer: RecommendationViewer;
	query: FeedEligibilityScope;
	snapshotId: string | null;
	asOf: Date;
	anchorId?: string;
}): Promise<FeedRankingCandidate[]> {
	if (!input.ids.length) return [];
	const selectedRealmId = getFeedCandidateRealmIdExpression(input.viewer, input.query.realmIds);
	const snapshotJoin = input.snapshotId
		? and(
				eq(recommendationUnitStat.snapshotId, input.snapshotId),
				eq(recommendationUnitStat.unitId, unit.id),
				isNull(recommendationUnitStat.contextRealmId),
			)
		: sql`false`;
	const preferredLanguage = input.viewer.preferredLanguages.length
		? sql<boolean>`exists (
			select 1 from ${unitLocalization} ${preferredLocalization}
			where ${preferredLocalization.unitId} = ${unit.id}
				and ${inArray(preferredLocalization.language, input.viewer.preferredLanguages)}
		)`
		: sql<boolean>`false`;
	const rows = await database
		.select({
			id: unit.id,
			unitKind: unit.kind,
			postKind: post.kind,
			creditedUnitIds: sql<string[]>`array(
				select distinct attribution.credited_unit_id::text
				from credit_attribution attribution
				where attribution.source_unit_id = ${unit.id}
				order by attribution.credited_unit_id::text
			)`,
			realmId: selectedRealmId,
			subjectId: post.subjectUnitId,
			rootPostId: postReply.rootPostId,
			parentPostId: postReply.parentPostId,
			createdAt: unit.createdAt,
			preferredLanguage,
			impressions: recommendationUnitStat.impressions,
			opens: recommendationUnitStat.opens,
			dwell30s: recommendationUnitStat.dwell30s,
			upvotes: recommendationUnitStat.upvotes,
			downvotes: recommendationUnitStat.downvotes,
			replies: recommendationUnitStat.replies,
			favorites: recommendationUnitStat.favorites,
			shares: recommendationUnitStat.shares,
			highScores: recommendationUnitStat.highScores,
			activeProgress: recommendationUnitStat.activeProgress,
			completions: recommendationUnitStat.completions,
			negativeProgress: recommendationUnitStat.negativeProgress,
			engagement6h: recommendationUnitStat.engagement6h,
			engagement24h: recommendationUnitStat.engagement24h,
			engagement7d: recommendationUnitStat.engagement7d,
		})
		.from(unit)
		.leftJoin(post, eq(post.id, unit.id))
		.leftJoin(postReply, eq(postReply.postId, unit.id))
		.leftJoin(recommendationUnitStat, snapshotJoin)
		.where(
			and(
				inArray(unit.id, input.ids),
				getFeedEligibilityCondition(input.viewer, input.query, input.asOf, input.anchorId),
			),
		);
	return rows.flatMap((row): FeedRankingCandidate[] => {
		const kind =
			row.unitKind === "post" && isFeedPostKind(row.postKind)
				? { unitKind: "post" as const, postKind: row.postKind }
				: isFeedUnitKind(row.unitKind)
					? { unitKind: row.unitKind, postKind: null }
					: null;
		if (!kind) return [];
		const stats: RecommendationStats = {
			...EmptyRecommendationStats,
			impressions: toCount(row.impressions, "recommendation impressions"),
			opens: toCount(row.opens, "recommendation opens"),
			dwell30s: toCount(row.dwell30s, "recommendation dwell count"),
			upvotes: toCount(row.upvotes, "recommendation upvotes"),
			downvotes: toCount(row.downvotes, "recommendation downvotes"),
			replies: toCount(row.replies, "recommendation replies"),
			favorites: toCount(row.favorites, "recommendation favorites"),
			shares: toCount(row.shares, "recommendation shares"),
			highScores: toCount(row.highScores, "recommendation high scores"),
			activeProgress: toCount(row.activeProgress, "recommendation active progress"),
			completions: toCount(row.completions, "recommendation completions"),
			negativeProgress: toCount(row.negativeProgress, "recommendation negative progress"),
			engagement6h: toNumber(row.engagement6h),
			engagement24h: toNumber(row.engagement24h),
			engagement7d: toNumber(row.engagement7d),
		};
		return [
			{
				id: row.id,
				...kind,
				creditedUnitIds: row.creditedUnitIds,
				realmId: row.realmId,
				subjectId: row.subjectId,
				rootPostId: row.rootPostId,
				parentPostId: row.parentPostId,
				createdAt: row.createdAt,
				personalizedRelevance:
					(input.sources.relevance.get(row.id) ?? 0) +
					(input.viewer.personalized && row.preferredLanguage ? 0.05 : 0),
				stats,
			},
		];
	});
}

export interface FeedHydrationCandidate {
	readonly id: string;
	readonly realmId: string | null;
}

export type FeedHydrationOrigin =
	| Readonly<{
			kind: "recommendation";
			reasons: ReadonlyMap<string, RecommendationReason>;
			surface: RecommendationSurface;
			requestId: string;
			positionOffset: number;
			policyVersion: string;
	  }>
	| Readonly<{ kind: "contextual" }>;

export async function hydrateFeedItems(
	page: readonly FeedHydrationCandidate[],
	viewer: RecommendationViewer,
	scope: FeedEligibilityScope,
	asOf: Date,
	origin: FeedHydrationOrigin,
): Promise<FeedItemResponseValue[]> {
	const pageIds = page.map(({ id }) => id);
	if (!pageIds.length) return [];
	const displayLanguages = resolveFeedLocalizationLanguages(scope.localizationLanguages, viewer);
	const allowedLanguages = scope.languages ?? [];
	const rows = await database
		.select({
			id: unit.id,
			unitKind: unit.kind,
			postKind: post.kind,
			subjectId: post.subjectUnitId,
			rootPostId: postReply.rootPostId,
			parentPostId: postReply.parentPostId,
			language: resolvedUnitLocalizationLanguage(unit.id, displayLanguages, allowedLanguages),
			body: unitLocalization.content,
			title: sql<string | null>`case
				when ${unit.kind} = 'structure' then (
					select string_agg(
						coalesce(
							${resolvedUnitLocalizationTitle(
								unitStructureMember.memberUnitId,
								displayLanguages,
								allowedLanguages,
							)},
							${unitStructureMember.memberUnitId}::text
						),
						' › ' order by ${unitStructureMember.ordinal}
					)
					from ${unitStructureMember}
					where ${unitStructureMember.structureId} = ${unit.id}
				)
				else ${unitLocalization.title}
			end`,
			summary: unitLocalization.summary,
			coverAssetId: resolvedUnitLocalizationImageAssetId(
				unit.id,
				"cover",
				displayLanguages,
				allowedLanguages,
			),
			avatar: resolvedUnitLocalizationAvatar(unit.id, displayLanguages, allowedLanguages),
			bannerAssetId: resolvedUnitLocalizationImageAssetId(
				unit.id,
				"banner",
				displayLanguages,
				allowedLanguages,
			),
			latestRevisionId: unitRevisionHead.revisionId,
			createdAt: unit.createdAt,
			updatedAt: unit.updatedAt,
		})
		.from(unit)
		.leftJoin(post, eq(post.id, unit.id))
		.leftJoin(postReply, eq(postReply.postId, unit.id))
		.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, unit.id))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, unit.id),
				eq(
					unitLocalization.language,
					resolvedUnitLocalizationLanguage(unit.id, displayLanguages, allowedLanguages),
				),
			),
		)
		.where(and(inArray(unit.id, pageIds), getFeedEligibilityCondition(viewer, scope, asOf)));
	if (!rows.length) return [];
	const validIds = rows.map(({ id }) => id);
	const rootPostIds = rows
		.filter(({ unitKind, postKind }) => unitKind === "post" && postKind !== "reply")
		.map(({ id }) => id);
	const replyIds = rows.filter(({ postKind }) => postKind === "reply").map(({ id }) => id);
	const reviewIds = rows.filter(({ postKind }) => postKind === "review").map(({ id }) => id);
	const wikiIds = rows.filter(({ postKind }) => postKind === "wiki").map(({ id }) => id);
	const tagIds = rows.filter(({ unitKind }) => unitKind === "tag").map(({ id }) => id);
	const scopedRealmIds = [...new Set(page.flatMap(({ realmId }) => (realmId ? [realmId] : [])))];
	const collectionIds = rows
		.filter(({ unitKind }) => unitKind === "collection")
		.map(({ id }) => id);
	const realmIds = rows.filter(({ unitKind }) => unitKind === "realm").map(({ id }) => id);
	const ratedWorkIds = rows
		.filter(
			(row): row is typeof row & { unitKind: FeedUnitKind } =>
				isFeedUnitKind(row.unitKind) && isFeedRatedWorkUnitKind(row.unitKind),
		)
		.map(({ id }) => id);
	const subjectIds = [
		...new Set(rows.flatMap(({ subjectId }) => (subjectId ? [subjectId] : []))),
	];
	const scoreTargetIds = [...new Set([...ratedWorkIds, ...subjectIds])];
	const globalScoreRealmId = OfficialRealmUnitIds.score;
	const scoreRealmIds = [...new Set([viewer.defaultScoreRealmId, globalScoreRealmId])];
	const rootIds = [
		...new Set(rows.flatMap(({ rootPostId }) => (rootPostId ? [rootPostId] : []))),
	];
	const [
		availableLanguageRows,
		rootReplyCounts,
		childReplyCounts,
		reactions,
		viewerReactions,
		subjectRows,
		scoreRows,
		scoreRealmRows,
		rootRows,
		collectionCounts,
		realmMemberCounts,
		realmTagContextRows,
		realmTagUnitContextRows,
		reviewScores,
	] = await Promise.all([
		database
			.select({
				unitId: unitLocalization.unitId,
				language: unitLocalization.language,
			})
			.from(unitLocalization)
			.where(inArray(unitLocalization.unitId, validIds))
			.orderBy(
				asc(unitLocalization.unitId),
				asc(unitLocalization.position),
				asc(unitLocalization.language),
			),
		rootPostIds.length
			? database
					.select({
						id: postReplyStat.postId,
						count: postReplyStat.visibleDescendantCount,
					})
					.from(postReplyStat)
					.where(inArray(postReplyStat.postId, rootPostIds))
			: [],
		replyIds.length
			? database
					.select({
						id: postReplyStat.postId,
						count: postReplyStat.visibleDirectCount,
					})
					.from(postReplyStat)
					.where(inArray(postReplyStat.postId, replyIds))
			: [],
		database
			.select({
				unitId: unitReactionGlobalStat.unitId,
				reaction: unitReactionGlobalStat.reaction,
				count: unitReactionGlobalStat.reactionCount,
			})
			.from(unitReactionGlobalStat)
			.where(inArray(unitReactionGlobalStat.unitId, validIds)),
		viewer.profileId
			? database
					.select({
						unitId: unitReaction.unitId,
						realmId: unitReaction.realmId,
						reaction: unitReaction.reaction,
					})
					.from(unitReaction)
					.where(
						and(
							eq(unitReaction.profileId, viewer.profileId),
							inArray(unitReaction.unitId, validIds),
						),
					)
			: [],
		subjectIds.length
			? database
					.select({
						id: unit.id,
						type: unit.kind,
						language: resolvedUnitLocalizationLanguage(unit.id, displayLanguages),
						title: unitLocalization.title,
						summary: unitLocalization.summary,
						coverAssetId: resolvedUnitLocalizationImageAssetId(
							unit.id,
							"cover",
							displayLanguages,
						),
					})
					.from(unit)
					.leftJoin(
						unitLocalization,
						and(
							eq(unitLocalization.unitId, unit.id),
							eq(
								unitLocalization.language,
								resolvedUnitLocalizationLanguage(unit.id, displayLanguages),
							),
						),
					)
					.where(
						and(
							inArray(unit.id, subjectIds),
							eq(unit.status, "published"),
							eq(unit.visibility, "public"),
							eq(unit.moderationStatus, "approved"),
							isNull(unit.deletedAt),
						),
					)
			: [],
		scoreTargetIds.length
			? database
					.select({
						unitId: scoreStat.unitId,
						realmId: scoreStat.realmId,
						totalScore: scoreStat.totalScore,
						totalCount: scoreStat.totalCount,
					})
					.from(scoreStat)
					.where(
						and(
							inArray(scoreStat.unitId, scoreTargetIds),
							inArray(scoreStat.realmId, scoreRealmIds),
						),
					)
			: [],
		database
			.select({
				id: unit.id,
				title: resolvedUnitLocalizationTitle(unit.id, displayLanguages),
			})
			.from(unit)
			.where(inArray(unit.id, scoreRealmIds)),
		rootIds.length
			? database
					.select({
						rootPostId: post.id,
						title: unitLocalization.title,
						subjectId: post.subjectUnitId,
					})
					.from(post)
					.innerJoin(unit, eq(unit.id, post.id))
					.leftJoin(
						unitLocalization,
						and(
							eq(unitLocalization.unitId, post.id),
							eq(
								unitLocalization.language,
								resolvedUnitLocalizationLanguage(post.id, displayLanguages),
							),
						),
					)
					.where(
						and(
							inArray(post.id, rootIds),
							getFeedEligibilityCondition(viewer, { content: ["post:post"] }, asOf),
						),
					)
			: [],
		collectionIds.length
			? database
					.select({
						collectionId: collectionItem.collectionId,
						count: sql<number>`count(*)::int`,
					})
					.from(collectionItem)
					.where(inArray(collectionItem.collectionId, collectionIds))
					.groupBy(collectionItem.collectionId)
			: [],
		realmIds.length
			? database
					.select({
						realmId: realmMember.realmId,
						count: sql<number>`count(*)::int`,
					})
					.from(realmMember)
					.where(
						and(
							inArray(realmMember.realmId, realmIds),
							eq(realmMember.state, "active"),
						),
					)
					.groupBy(realmMember.realmId)
			: [],
		wikiIds.length
			? database
					.select({
						contextPostId: realmTagContext.contextPostId,
						realmId: realmTagContext.realmId,
						tagId: realmTagContext.tagId,
						language: resolvedUnitLocalizationLanguage(
							feedRealmContextTagUnit.id,
							displayLanguages,
						),
						title: resolvedUnitLocalizationTitle(
							feedRealmContextTagUnit.id,
							displayLanguages,
						),
						avatar: resolvedUnitLocalizationAvatar(
							feedRealmContextTagUnit.id,
							displayLanguages,
						),
					})
					.from(realmTagContext)
					.innerJoin(
						realmUnit,
						and(
							eq(realmUnit.realmId, realmTagContext.realmId),
							eq(realmUnit.unitId, realmTagContext.contextPostId),
							eq(realmUnit.status, "visible"),
							eq(realmUnit.publicationState, "active"),
						),
					)
					.innerJoin(
						feedRealmContextTagUnit,
						eq(feedRealmContextTagUnit.id, realmTagContext.tagId),
					)
					.where(
						and(
							inArray(realmTagContext.contextPostId, wikiIds),
							getUnitReadCondition(viewer.profileId, {}, feedRealmContextTagUnit),
						),
					)
			: [],
		tagIds.length && scopedRealmIds.length
			? database
					.select({
						realmId: realmTagContext.realmId,
						tagId: realmTagContext.tagId,
						contextPostId: realmTagContext.contextPostId,
						language: resolvedUnitLocalizationLanguage(
							feedRealmContextPostUnit.id,
							displayLanguages,
						),
						summary: resolvedUnitLocalizationSummary(
							feedRealmContextPostUnit.id,
							displayLanguages,
						),
					})
					.from(realmTagContext)
					.innerJoin(
						realmUnit,
						and(
							eq(realmUnit.realmId, realmTagContext.realmId),
							eq(realmUnit.unitId, realmTagContext.contextPostId),
							eq(realmUnit.status, "visible"),
							eq(realmUnit.publicationState, "active"),
						),
					)
					.innerJoin(
						feedRealmContextPostUnit,
						eq(feedRealmContextPostUnit.id, realmTagContext.contextPostId),
					)
					.where(
						and(
							inArray(realmTagContext.realmId, scopedRealmIds),
							inArray(realmTagContext.tagId, tagIds),
							getUnitReadCondition(viewer.profileId, {}, feedRealmContextPostUnit),
						),
					)
			: [],
		reviewIds.length
			? database
					.select({
						postId: postScore.postId,
						scoreId: score.id,
						realmId: score.realmId,
						realmTitle: resolvedUnitLocalizationTitle(
							feedReviewScoreRealm.id,
							displayLanguages,
						),
						value: score.value,
						position: postScore.position,
					})
					.from(postScore)
					.innerJoin(score, eq(score.id, postScore.scoreId))
					.innerJoin(profilePreference, eq(profilePreference.profileId, score.profileId))
					.innerJoin(
						feedReviewScoreTargetUnit,
						eq(feedReviewScoreTargetUnit.id, score.unitId),
					)
					.innerJoin(feedReviewScoreRealm, eq(feedReviewScoreRealm.id, score.realmId))
					.where(
						and(
							inArray(postScore.postId, reviewIds),
							getProfileActivityReadCondition({
								ownerProfileId: score.profileId,
								categoryVisibility: profilePreference.scoreVisibility,
								itemVisibility: score.visibility,
								viewerProfileId: viewer.profileId,
								surface: "linked",
							}),
							getUnitReadCondition(viewer.profileId, {}, feedReviewScoreTargetUnit),
							getUnitReadCondition(viewer.profileId, {}, feedReviewScoreRealm),
						),
					)
					.orderBy(asc(postScore.postId), asc(postScore.position), asc(score.id))
			: [],
	]);
	const [attributions, rootAttributions, realmContexts] = await Promise.all([
		getAttributionSummariesByUnitIds(validIds, displayLanguages),
		getAttributionSummariesByUnitIds(rootIds, displayLanguages),
		getFeedRealmContextsByUnitIds(validIds, displayLanguages),
	]);
	const subjects = new Map(
		subjectRows.flatMap((subject) => {
			const language = subject.language;
			if (!language) return [];
			return [
				[
					subject.id,
					{
						id: subject.id,
						type: subject.type,
						language,
						title: subject.title,
						summary: subject.summary,
						cover: presentImageAsset(subject.coverAssetId, "cover"),
					},
				] as const,
			];
		}),
	);
	const rowMap = new Map(rows.map((row) => [row.id, row]));
	const availableLanguagesByUnitId = new Map<string, ContentLanguage[]>();
	for (const { unitId, language } of availableLanguageRows) {
		const languages = availableLanguagesByUnitId.get(unitId) ?? [];
		languages.push(language);
		availableLanguagesByUnitId.set(unitId, languages);
	}
	const pageMap = new Map(page.map((item) => [item.id, item]));
	const rootContext = new Map(
		rootRows.map((row) => [
			row.rootPostId,
			{ ...row, attributions: rootAttributions.get(row.rootPostId) ?? [] },
		]),
	);
	const rootCount = new Map(
		rootReplyCounts.map((row) => [row.id, toSafeInteger(row.count, "reply count")]),
	);
	const childCount = new Map(
		childReplyCounts.map((row) => [row.id, toSafeInteger(row.count, "reply count")]),
	);
	const collectionDirectItemCount = new Map(
		collectionCounts.map((row) => [row.collectionId, row.count]),
	);
	const realmMemberCount = new Map(realmMemberCounts.map((row) => [row.realmId, row.count]));
	const realmTagContextByPostId = new Map(
		realmTagContextRows.flatMap(({ contextPostId, avatar, ...context }) =>
			context.language
				? [
						[
							contextPostId,
							{
								realmId: context.realmId,
								tag: {
									id: context.tagId,
									language: context.language,
									title: context.title,
									avatar: presentAvatar(avatar),
								},
							},
						] as const,
					]
				: [],
		),
	);
	const realmTagContextByRealmTag = new Map(
		realmTagUnitContextRows.map((context) => [`${context.realmId}:${context.tagId}`, context]),
	);
	const reactionCount = new Map(
		reactions.map((row) => [
			`${row.unitId}:${row.reaction}`,
			toSafeInteger(row.count, "reaction count"),
		]),
	);
	const ownReaction = new Map(
		viewerReactions.map((row) => [`${row.unitId}:${row.realmId ?? ""}`, row.reaction]),
	);
	const scoreAggregates = new Map(
		scoreRows.flatMap((row) => {
			const totalCount = toSafeInteger(row.totalCount, "feed score count");
			return totalCount > 0
				? [
						[
							`${row.unitId}:${row.realmId}`,
							{
								realmId: row.realmId,
								totalScore: toSafeInteger(row.totalScore, "feed total score"),
								totalCount,
							},
						] as const,
					]
				: [];
		}),
	);
	const scoreRealmTitles = new Map(scoreRealmRows.map(({ id, title }) => [id, title] as const));
	const scoresFor = (targetId: string) =>
		createFeedScoreCandidates({
			aggregates: scoreAggregates,
			realmTitles: scoreRealmTitles,
			defaultRealmId: viewer.defaultScoreRealmId,
			globalRealmId: globalScoreRealmId,
			targetId,
		});
	const scoresByPostId = new Map<
		string,
		{
			scoreId: string;
			realmId: string;
			realmTitle: string | null;
			value: number;
		}[]
	>();
	for (const { postId, position: _position, ...reviewScore } of reviewScores) {
		const current = scoresByPostId.get(postId) ?? [];
		current.push(reviewScore);
		scoresByPostId.set(postId, current);
	}
	return pageIds.flatMap((id, index): FeedItemResponseValue[] => {
		const row = rowMap.get(id);
		const ranked = pageMap.get(id);
		if (!row || !ranked) return [];
		const tracking =
			origin.kind === "recommendation"
				? createRecommendationTracking(row.id, {
						requestId: origin.requestId,
						surface: origin.surface,
						position: origin.positionOffset + index,
						policyVersion: origin.policyVersion,
					})
				: null;
		const common = {
			id: row.id,
			language: row.language,
			availableLanguages: availableLanguagesByUnitId.get(row.id) ?? [],
			attributions: attributions.get(row.id) ?? [],
			realmId: ranked.realmId,
			realms: prioritizeFeedRealmContexts(realmContexts.get(row.id) ?? [], ranked.realmId),
			title: row.title,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
			reactions: {
				upvote: reactionCount.get(`${row.id}:upvote`) ?? 0,
				downvote: reactionCount.get(`${row.id}:downvote`) ?? 0,
			},
			viewerReaction: ownReaction.get(`${row.id}:${ranked.realmId ?? ""}`) ?? null,
			recommendationReason:
				origin.kind === "recommendation" ? (origin.reasons.get(row.id) ?? null) : null,
			tracking,
		};
		if (isFeedUnitKind(row.unitKind)) {
			const unitItem = {
				...common,
				itemType: "unit" as const,
				postKind: null,
				summary: row.summary,
				cover: presentImageAsset(row.coverAssetId, "cover"),
				collection:
					row.unitKind === "collection"
						? {
								directItemCount: collectionDirectItemCount.get(row.id) ?? 0,
							}
						: null,
			};
			if (isFeedRatedWorkUnitKind(row.unitKind))
				return [
					{
						...unitItem,
						unitKind: row.unitKind,
						presentation: {
							kind: "rated-work",
							scores: scoresFor(row.id),
						},
					},
				];
			if (row.unitKind === "realm" || row.unitKind === "zone" || row.unitKind === "tag")
				return [
					{
						...unitItem,
						unitKind: row.unitKind,
						presentation: {
							kind: "identity",
							avatar: presentAvatar(row.avatar),
							banner: presentImageAsset(row.bannerAssetId, "banner"),
							memberCount:
								row.unitKind === "realm"
									? (realmMemberCount.get(row.id) ?? 0)
									: null,
							realmTagContext:
								row.unitKind === "tag" && ranked.realmId
									? (realmTagContextByRealmTag.get(
											`${ranked.realmId}:${row.id}`,
										) ?? null)
									: null,
						},
					},
				];
			return [
				{
					...unitItem,
					unitKind: row.unitKind,
					presentation: { kind: "general" },
				},
			];
		}
		if (row.unitKind !== "post" || !isFeedPostKind(row.postKind)) return [];
		const subject = row.subjectId ? subjects.get(row.subjectId) : undefined;
		if (row.postKind === "excerpt" && !subject) return [];
		const postItem = {
			...common,
			itemType: "post" as const,
			unitKind: "post" as const,
			summary: row.summary,
			cover: presentImageAsset(row.coverAssetId, "cover"),
			subjectId: row.subjectId,
			rootPostId: row.rootPostId,
			parentPostId: row.parentPostId,
			body: row.body === null ? null : toPortableTextResponse(row.body),
			replyCount:
				row.postKind === "reply"
					? (childCount.get(row.id) ?? 0)
					: (rootCount.get(row.id) ?? 0),
			title: row.title,
			latestRevisionId: row.latestRevisionId,
			replyContext: row.rootPostId ? (rootContext.get(row.rootPostId) ?? null) : null,
			subject: subject
				? {
						...subject,
						scores: scoresFor(subject.id),
					}
				: null,
		};
		return row.postKind === "review"
			? [
					{
						...postItem,
						postKind: row.postKind,
						scores: scoresByPostId.get(row.id) ?? [],
					},
				]
			: row.postKind === "wiki"
				? [
						{
							...postItem,
							postKind: row.postKind,
							realmTagContext: realmTagContextByPostId.get(row.id) ?? null,
						},
					]
				: [
						{
							...postItem,
							postKind: row.postKind,
						},
					];
	});
}

export default new Elysia({ prefix: "/feed" }).model(FilterSchemaModels).post(
	"/query",
	async ({ body, request }) => {
		if (body.filter)
			try {
				assertUnitFilter(body.filter);
			} catch {
				throw new InvalidFeedFilter();
			}
		const identity = await resolveIdentity(request, "unit:read");
		const viewer = await resolveRecommendationViewer(identity.profile?.unitId);
		const cursor = decodeCursor(body.cursor);
		const simpleSelection = body.filter?.where
			? readSimpleFeedFilter(body.filter.where)
			: undefined;
		const contentKinds = body.filter?.where
			? readSimpleFeedContentKinds(body.filter.where)
			: undefined;
		const filterLanguages = body.filter?.where
			? (readUnitLanguageBoundary(body.filter.where) ?? [])
			: [];
		const localizationLanguages = resolveFeedLocalizationLanguages(
			body.localizationLanguages,
			viewer,
		);
		validateCursor(cursor, body, viewer.personalized, filterLanguages, localizationLanguages);
		const baseScope: FeedEligibilityScope = {
			...(body.filter?.where ? { filter: body.filter.where } : {}),
			...(contentKinds?.length ? { content: contentKinds } : {}),
			...(filterLanguages.length ? { languages: filterLanguages } : {}),
			...(localizationLanguages.length ? { localizationLanguages } : {}),
			...(simpleSelection?.realmIds.length ? { realmIds: simpleSelection.realmIds } : {}),
		};
		let searchSelection: FeedSearchSelection | undefined;
		if (body.filter && "search" in body.filter)
			try {
				searchSelection = await resolveFeedSearchSelection({
					content: baseScope.content,
					filter: baseScope.filter,
					profileId: viewer.profileId,
					query: body.filter.search.query,
				});
			} catch (cause) {
				if (cause instanceof InvalidSearch || cause instanceof SearchUnavailable)
					throw cause;
				throw new SearchUnavailable(cause);
			}
		const scope: FeedEligibilityScope = {
			...baseScope,
			...(searchSelection ? { searchCandidateIds: searchSelection.ids } : {}),
		};
		const snapshot = cursor?.snapshotId
			? await resolveRecommendationSnapshot(cursor.snapshotId)
			: cursor
				? null
				: await resolveRecommendationSnapshot();
		if (cursor?.snapshotId && !snapshot) throw new InvalidFeedCursor();
		const snapshotContext = snapshot ?? fallbackRecommendationSnapshot;
		if (cursor && cursor.policyVersion !== snapshotContext.policyVersion)
			throw new InvalidFeedCursor();
		const sort = body.sort ?? "best";
		const asOf = cursor ? new Date(cursor.asOf) : new Date();
		const sources = await getCandidateSources({
			viewer,
			query: scope,
			sort,
			snapshotId: snapshotContext.id,
			asOf,
			...(cursor ? { anchorId: cursor.lastId } : {}),
		});
		const candidates = await getFeedRankingCandidates({
			ids: sources.ids,
			sources,
			viewer,
			query: scope,
			snapshotId: snapshotContext.id,
			asOf,
			...(cursor ? { anchorId: cursor.lastId } : {}),
		});
		const ranked = rankRecommendations(candidates, {
			sort,
			personalized: viewer.personalized,
			asOf,
			pageSize: body.limit ?? 20,
			...(simpleSelection?.realmIds.length === 1
				? { scopedRealmId: simpleSelection.realmIds[0] }
				: {}),
		});
		const start = cursor ? ranked.findIndex(({ id }) => id === cursor.lastId) + 1 : 0;
		if (cursor && start === 0) throw new InvalidFeedCursor();
		const limit = body.limit ?? 20;
		const page = ranked.slice(start, start + limit);
		const requestId = crypto.randomUUID();
		const items = await hydrateFeedItems(page, viewer, scope, asOf, {
			kind: "recommendation",
			reasons: sources.reason,
			surface: "home_feed",
			requestId,
			positionOffset: start,
			policyVersion: snapshotContext.policyVersion,
		});
		const last = page.at(-1);
		return {
			items,
			total: createFeedTotal({
				candidates: ranked,
				coverage: sources.coverage,
				searchRelation: searchSelection?.relation ?? "exact",
			}),
			nextCursor:
				start + page.length < ranked.length && last
					? Buffer.from(
							JSON.stringify({
								v: 9,
								sort,
								filterHash: body.filter
									? createHash("sha256")
											.update(canonicalUnitFilter(body.filter))
											.digest("hex")
									: null,
								filterLanguages,
								localizationLanguages,
								personalized: viewer.personalized,
								snapshotId: snapshotContext.id,
								policyVersion: snapshotContext.policyVersion,
								limit,
								asOf: asOf.toISOString(),
								lastId: last.id,
							}),
						).toString("base64url")
					: null,
		};
	},
	{
		body: FeedRequest,
		response: {
			[StatusCodes.OK]: FeedResponse,
			[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
				"InvalidFeedCursor",
				"InvalidFeedFilter",
			]),
			[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidSearch"]),
			[StatusCodes.SERVICE_UNAVAILABLE]: toApiErrorResponse(["SearchUnavailable"]),
		},
		detail: { summary: "Ranked realm feed", tags: ["Feed"] },
	},
);
