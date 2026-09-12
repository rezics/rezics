import { referenceValueIdForNativeId } from "../../units/reference-value";
import { recommendationExclusionCondition } from "../../recommendations/exclusion-query";
import { UnitOwnerSchema, type UnitOwner } from "@rezics/reference";
import { unitStateRelation, unitStatesForIds } from "../../units/state-relation";
import {presentImageAsset} from "../image-assets/presentation";
import type { PresentedAvatar } from "@rezics/avatar";
import {
	assertUnitFilter,
	canonicalUnitFilter,
	readSimpleFeedContentKinds,
	readSimpleFeedFilter,
	readUnitLanguageBoundary,
	type SearchCategory,
	type UnitPredicate,
} from "@rezics/filter";
import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { and, asc, eq, exists, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";
import { createHash } from "node:crypto";
import type { StaticDecode } from "typebox";
import { selfAuthUserIdForEntity } from "../../participation/account-query";

import { resolveIdentity } from "../../auth/session";
import { getProfileActivityReadCondition } from "../../authorization/profile-activity/query";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { requireContentSpoilerLevel } from "../../content-labels/presentation";
import {
	contentRatingPolicyFromAllowlist,
	getContentRatingCondition,
} from "../../content-rating/policy";
import type { SearchCountResult } from "../../counts/contract";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import {
	accountPreference,
	collectionStat,
	ContentRatingValues,
	post,
	postReply,
	postReplyStat,
	postScore,
	realmStat,
	realmTagContext,
	realmUnit,
	score,
	scoreStat,
	realm,
	tag,
	unitBestScore,
	unitFollow,
	unitLocalization,
	unitReaction,
	unitReactionGlobalStat,
	unitRevisionHead,
	unitTag,
} from "../../database/schema";
import type { ContentRating } from "../../database/schema/contract-values";
import { compileUnitPredicateSql } from "../../filter/sql";
import { parseJsonCursor } from "../../pagination";
import {
	fallbackRecommendationSnapshot,
	resolveRecommendationSnapshot,
	resolveRecommendationViewer,
	type RecommendationViewer,
} from "../../recommendations/context";
import type { RecommendationCandidate } from "../../recommendations/ranking";
import { createRecommendationTracking } from "../../recommendations/tracking";
import { InvalidSearch, SearchUnavailable } from "../../search/errors";
import type { SearchKeysetPosition } from "../../search/query";
import { SearchCategories } from "../../search/schema";
import { searchGlobalIdentifiers, type GlobalSearchBranch } from "../../search/service";
import {
	getAttributionSummariesByUnitIds,
	getPublicUnitSummariesByIds,
} from "../../units/attribution";
import { presentAvatar } from "../../units/avatar";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
} from "../../units/localization";

import type { PublicCanonicalUnitSlugAddress } from "../../units/slug-address";
import {
	RecommendationPolicyVersionSchema,
	type RecommendationReason,
	type RecommendationSurface,
} from "../recommendations/schema";
import { FeedResponse, toApiErrorResponse, type FeedItemResponseValue } from "../schema/response";
import { resolveFeedPageContinuation } from "./continuation";
import { InvalidFeedCursor, InvalidFeedFilter } from "./errors";
import {
	DefaultFeedContentKindValues,
	FeedContentKindValues,
	FeedPostKindValues,
	FeedRatedWorkOwnerValues,
	FeedRequest,
	FeedSortSchema,
	FeedUnitOwnerValues,
	MaximumFeedAttributionsPerItem,
	MaximumFeedRealmContextsPerItem,
	type FeedContentKind,
	type FeedPostKind,
	type FeedRequest as FeedRequestType,
	type FeedSort,
	type FeedUnitOwner,
} from "./schema";

const feedUnit = unitStateRelation(sql`null::uuid`, "search_unit");
const feedReviewScoreTargetUnit = unitStateRelation(score.unitId, "feed_review_score_target");
const feedReviewScoreRealm = alias(realm, "feed_review_score_realm");
const feedRealmContextTagUnit = alias(tag, "feed_realm_context_tag_unit");
const feedRealmContextPostUnit = alias(post, "feed_realm_context_post_unit");

interface FeedRealmContextSummary {
	readonly id: string;
	readonly language: string | null;
	readonly slugAddress: PublicCanonicalUnitSlugAddress | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: PresentedAvatar | null;
}

async function getFeedRealmContextsByUnitIds(
	candidates: readonly FeedHydrationCandidate[],
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<Map<string, FeedRealmContextSummary[]>> {
	const requested = [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
	const result = new Map<string, FeedRealmContextSummary[]>();
	for (const { id } of requested) result.set(id, []);
	if (!requested.length) return result;
	const membershipRows = await database.execute<{
		readonly unitId: string;
		readonly realmId: string;
	}>(
		sql`
			select
				requested.unit_id as "unitId",
				bounded.realm_id as "realmId"
			from (values ${sql.join(
				requested.map(({ id, realmId }) => sql`(${id}::uuid, ${realmId}::uuid)`),
				sql`, `,
			)}) as requested(unit_id, primary_realm_id)
			cross join lateral (
				select membership.realm_id
                from (select realm_id,updated_at from ${realmUnit}
                  where unit_id=requested.unit_id and status='visible' and publication_state='active'
                  order by updated_at desc,realm_id desc limit 32) membership
                inner join ${realm} as context_realm on context_realm.id=membership.realm_id
                where context_realm.status='published' and context_realm.moderation_status='approved'
					and context_realm.visibility = 'public'
					and context_realm.deleted_at is null
				order by
					(membership.realm_id = requested.primary_realm_id) desc nulls last,
					membership.updated_at desc,
					membership.realm_id desc
				limit ${MaximumFeedRealmContextsPerItem}
			) as bounded
			order by requested.unit_id, (bounded.realm_id = requested.primary_realm_id) desc, bounded.realm_id
		`,
	);
	const realmSummaries = await getPublicUnitSummariesByIds(
		membershipRows.rows.map(({ realmId }) => realmId),
		localizationLanguages,
	);
	for (const row of membershipRows.rows) {
		const realm = realmSummaries.get(row.realmId);
		if (!realm || realm.owner !== "realm") continue;
		result.get(row.unitId)?.push({
			id: realm.id,
			language: realm.language,
			slugAddress: realm.slugAddress,
			title: realm.title,
			summary: realm.summary,
			avatar: realm.avatar,
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

type FeedContentDefinition = { readonly owner: FeedUnitOwner | "post"; readonly shape: string };
const FeedContentDefinitions = Object.fromEntries(FeedContentKindValues.map(token => {
 const [owner, shape] = token.split(":");
 if (!shape) throw new Error("Invalid feed content shape");
 return [token, {owner: UnitOwnerSchema.parse(owner), shape}];
}));
function feedDefinition(token: FeedContentKind): FeedContentDefinition {
 const definition = FeedContentDefinitions[token];
 if (!definition || !(definition.owner === "post" || isFeedUnitOwner(definition.owner))) throw new Error("Invalid feed content owner");
 return {...definition, owner: definition.owner};
}
const FeedUnitOwners: ReadonlySet<string> = new Set(FeedUnitOwnerValues);
const FeedPostKinds: ReadonlySet<string> = new Set(FeedPostKindValues);
const FeedRatedWorkOwners: ReadonlySet<string> = new Set(FeedRatedWorkOwnerValues);
function isFeedUnitOwner(value: string): value is FeedUnitOwner {return FeedUnitOwners.has(value);}
function isFeedPostKind(value: string | null): value is FeedPostKind {return value !== null && FeedPostKinds.has(value);}
function isFeedRatedWorkOwner(value: string) {return FeedRatedWorkOwners.has(value);}

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
 const selected = FeedContentKindValues.filter(kind => requested.has(kind));
 const definitions = selected.map(feedDefinition);
 return {selected, definitions, owners: [...new Set(definitions.filter(d => d.owner !== "post").map(d => d.owner))], postKinds: definitions.flatMap(d => isFeedPostKind(d.shape) && d.owner === "post" ? [d.shape] : [])};
}
function feedSearchCategory(token: FeedContentKind): SearchCategory {
 const d = feedDefinition(token);
 switch(d.owner) {
  case "entity": return "entities";
  case "tag": return "tags";
  case "collection": return "collections";
  case "poll": return "polls";
  case "realm": return "realms";
  case "post": return d.shape === "review" ? "reviews" : "posts";
  default: return "units";
 }
}

export function resolveFeedSearchCategories(
	content?: readonly FeedContentKind[],
): SearchCategory[] {
	const requested = new Set(
		resolveFeedContentSelection(content).selected.map(
			(kind) => feedSearchCategory(kind),
		),
	);
	return SearchCategories.filter((category) => requested.has(category));
}

interface FeedSearchSelection {
	readonly ids: readonly string[];
	readonly kind: "exact" | "lower-bound";
	readonly coverage: FeedCandidateCoverage;
	readonly nextPosition?: SearchKeysetPosition;
}

type FeedTotalKind = FeedSearchSelection["kind"];
type FeedCandidateCoverage = "bounded" | "exhaustive";

async function resolveFeedSearchSelection(input: {
	readonly content?: readonly FeedContentKind[];
	readonly filter: UnitPredicate | undefined;
	readonly profileId: string | undefined;
	readonly contentRatings: RecommendationViewer["contentRatings"];
	readonly query: string;
	readonly sort: FeedSort;
 readonly snapshotId:string|null;
	readonly limit: number;
	readonly eligibilityCondition: SQL;
	readonly position?: SearchKeysetPosition;
}): Promise<FeedSearchSelection> {
 const definitions = resolveFeedContentSelection(input.content).selected;
 // Preserve native pairs in the common eligibility predicate; source restrictions run before limits.
 const grouped = new Map<SearchCategory, {owners: Set<UnitOwner>; shapes: Set<string>}>();
 for (const token of definitions) {
  const d = feedDefinition(token), category = feedSearchCategory(token);
  const group = grouped.get(category) ?? {owners: new Set<UnitOwner>(), shapes: new Set<string>()};
  group.owners.add(d.owner); group.shapes.add(d.shape); grouped.set(category,group);
 }
 const branches: GlobalSearchBranch[] = [...grouped].map(([category, group]) => ({category, sourceOwners:[...group.owners], sourceShapes:[...group.shapes]}));
	const page = await searchGlobalIdentifiers({
		branches,
        bestSnapshotId:input.snapshotId,
		...(input.filter ? { domainFilter: input.filter } : {}),
		...(input.profileId ? { profileId: input.profileId } : {}),
		contentRatingPolicy: contentRatingPolicyFromAllowlist(input.contentRatings),
		contentRatings: [...input.contentRatings],
		query: input.query,
		limit: input.limit,
		sort: input.sort === "new" ? "createdAt:desc" : "best",
		additionalConditions: [input.eligibilityCondition],
		...(input.position ? { position: input.position } : {}),
	});
	return {
		ids: page.hits.map(({ id }) => id),
		kind: page.total.kind,
		coverage: page.exhausted ? "exhaustive" : "bounded",
		...(page.nextPosition ? { nextPosition: page.nextPosition } : {}),
	};
}

interface FeedEligibilityBaseScope {
	readonly content?: readonly FeedContentKind[];
	readonly languages?: readonly ContentLanguage[];
	readonly localizationLanguages?: readonly ContentLanguage[];
	readonly realmIds?: readonly string[];
	readonly subjectId?: string;
	readonly filter?: UnitPredicate;
	readonly reviewScore?: never;
}

interface FeedReviewEligibilityScope
	extends Omit<FeedEligibilityBaseScope, "content" | "reviewScore"> {
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

const FeedSearchPosition = t.Union([
	t.Object(
		{
			primary: t.String(),
			secondary: t.String(),
			unitId: t.String({ format: "uuid" }),
			source: t.Literal("ordered"),
		},
		{ additionalProperties: false },
	),
	t.Object(
		{
			primary: t.String(),
			secondary: t.String(),
			unitId: t.String({ format: "uuid" }),
			source: t.Union([t.Literal("best-positive"), t.Literal("best-zero")]),
			snapshotId: t.Nullable(t.String({ format: "uuid" })),
		},
		{ additionalProperties: false },
	),
]);

const FeedCursor = t.Object(
	{
		v: t.Literal(1),
		sort: FeedSortSchema,
		filterHash: t.Nullable(t.String({ pattern: "^[0-9a-f]{64}$" })),
		filterLanguages: t.Array(t.UnionEnum(ContentLanguageValues), { uniqueItems: true }),
		localizationLanguages: t.Array(t.UnionEnum(ContentLanguageValues), {
			uniqueItems: true,
		}),
		contentRatings: t.Array(t.UnionEnum(ContentRatingValues), { uniqueItems: true }),
		personalized: t.Boolean(),
		snapshotId: t.Nullable(t.String({ format: "uuid" })),
		policyVersion: RecommendationPolicyVersionSchema,
		limit: t.Integer({ minimum: 1, maximum: 50 }),
		asOf: t.String({ format: "date-time" }),
		searchPosition: FeedSearchPosition,
		positionOffset: t.Integer({ minimum: 0 }),
	},
	{ additionalProperties: false },
);
type FeedCursor = StaticDecode<typeof FeedCursor>;

function toFeedSearchPosition(position: SearchKeysetPosition): FeedCursor["searchPosition"] {
	if (position.primary === null || position.secondary === null)
		throw new Error("Feed Search returned an incomplete keyset position");
	if (position.source === "count-positive" || position.source === "count-zero")
		throw new Error("Feed Search returned an incompatible sparse-count position");
	if (!position.source || position.source === "ordered")
		return {
			primary: position.primary,
			secondary: position.secondary,
			unitId: position.unitId,
			source: "ordered",
		};
	if (position.source === "best-positive" || position.source === "best-zero")
		return {
			primary: position.primary,
			secondary: position.secondary,
			unitId: position.unitId,
			source: position.source,
			snapshotId: position.snapshotId,
		};
	throw new Error("Feed Search returned an unsupported keyset position");
}

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
	contentRatings: readonly ContentRating[],
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
		cursor.contentRatings.length !== contentRatings.length ||
		cursor.contentRatings.some((rating, index) => rating !== contentRatings[index]) ||
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
 const { definitions } = resolveFeedContentSelection(scope.content);
 const contentCondition = definitions.length ? or(...definitions.map(d => and(eq(feedUnit.owner, d.owner), eq(feedUnit.shape, d.shape)))) : sql`false`;
	return and(
		contentCondition,
		eq(feedUnit.status, "published"),
		eq(feedUnit.visibility, "public"),
		eq(feedUnit.moderationStatus, "approved"),
		isNull(feedUnit.deletedAt),
		lte(feedUnit.createdAt, asOf),
        lte(feedUnit.updatedAt,asOf),
		sql`(${feedUnit.owner} <> 'post'
			or not exists (
				select 1 from post candidate_post
				where candidate_post.id = ${feedUnit.id}
					and candidate_post.kind = 'reply'::post_kind
			)
			or exists (
				select 1 from post_reply readable_reply
				join post readable_root on readable_root.id = readable_reply.root_post_id
				where readable_reply.post_id = ${feedUnit.id}
					and readable_root.status = 'published'
					and readable_root.visibility = 'public'
					and readable_root.moderation_status = 'approved'
					and readable_root.deleted_at is null
					and ${getContentRatingCondition(contentRatingPolicyFromAllowlist(viewer.contentRatings), sql`readable_root.content_rating`)}
			))`,
		scope.languages?.length
			? sql`(public.catalog_name_has_languages(${feedUnit.id}, ${sql.param(scope.languages)}::text[], false) or exists (
				select 1 from unit_localization scoped_localization
				where scoped_localization.unit_id = ${feedUnit.id}
					and scoped_localization.language in (${sql.join(
						scope.languages.map((language) => sql`${language}`),
						sql`, `,
					)})
			))`
			: undefined,
		scope.realmIds?.length
			? sql`exists (
				select 1 from realm_unit scoped_content
				where scoped_content.unit_id = ${feedUnit.id}
					and scoped_content.realm_id in (${sql.join(
						scope.realmIds.map((realmId) => sql`${realmId}::uuid`),
						sql`, `,
					)})
					and scoped_content.status = 'visible'
					and scoped_content.publication_state = 'active'
			)`
			: undefined,
		scope.subjectId
			? exists(
					database
						.select({ id: post.id })
						.from(post)
						.where(and(eq(post.id, feedUnit.id), eq(post.subjectUnitId, scope.subjectId))),
				)
			: undefined,
		scope.reviewScore
			? exists(
					database
						.select({ scoreId: score.id })
						.from(postScore)
						.innerJoin(score, eq(score.id, postScore.scoreId))
						.innerJoin(
							accountPreference,
							eq(accountPreference.authUserId, selfAuthUserIdForEntity(score.profileId)),
						)
						.innerJoinLateral(feedReviewScoreTargetUnit, sql`true`)
						.innerJoin(feedReviewScoreRealm, eq(feedReviewScoreRealm.id, score.realmId))
						.where(
							and(
								eq(postScore.postId, feedUnit.id),
								eq(score.realmId, scope.reviewScore.realmId),
								inArray(score.value, scope.reviewScore.values),
								getProfileActivityReadCondition({
									ownerProfileId: score.profileId,
									categoryVisibility: accountPreference.scoreVisibility,
									itemVisibility: score.visibility,
									viewerProfileId: viewer.profileId,
									surface: "linked",
								}),
								getUnitReadCondition(viewer.profileId, {}, feedReviewScoreTargetUnit),
								getUnitReadCondition(viewer.profileId, {}, feedReviewScoreRealm),
							),
						),
				)
			: undefined,
		scope.filter
			? compileUnitPredicateSql(scope.filter, {
					unitId: sql`${feedUnit.id}`,
					unitOwner: sql`${feedUnit.owner}`,
                    unitShape: sql`${feedUnit.shape}`,
					...(viewer.profileId ? { viewerProfileId: viewer.profileId } : {}),
				})
			: undefined,
		getContentRatingCondition(contentRatingPolicyFromAllowlist(viewer.contentRatings), feedUnit.contentRating),
		viewer.profileId
			? sql`not exists (
				select 1 from credit_attribution attribution
				join account_entity_block blocked on
					(blocked.blocker_auth_user_id = ${selfAuthUserIdForEntity(viewer.profileId)} and blocked.blocked_entity_id = attribution.credited_entity_id)
                    or (blocked.blocker_auth_user_id = ${selfAuthUserIdForEntity(sql`attribution.credited_entity_id`)} and blocked.blocked_entity_id = ${viewer.profileId}::uuid)
				where attribution.source_unit_id = ${feedUnit.id}
			)`
			: undefined,
		// A nullable probe exempts the cursor anchor without defeating the exclusion anti-join.
		viewer.profileId
			? sql`not ${recommendationExclusionCondition(anchorId ? sql`nullif(${feedUnit.id},${anchorId}::uuid)` : feedUnit.id, selfAuthUserIdForEntity(viewer.profileId))}`
			: undefined,
	)!;
}

export interface CandidateSources {
	ids: string[];
	reason: Map<string, RecommendationReason>;
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
	readonly searchKind: FeedTotalKind;
	readonly positionOffset?: number;
}): SearchCountResult {
	const positionOffset = input.positionOffset ?? 0;
	if (!Number.isSafeInteger(positionOffset) || positionOffset < 0)
		throw new RangeError("Feed position offset must be a non-negative safe integer");
	const value = positionOffset + input.candidates.length;
	if (!Number.isSafeInteger(value)) throw new RangeError("Feed total exceeds safe integer range");
	return {
		kind: input.coverage === "exhaustive" && input.searchKind === "exact" ? "exact" : "lower-bound",
		value,
	};
}

export interface FeedRankingCandidate extends RecommendationCandidate {
	owner: FeedUnitOwner | "post";
	shape: string;
	postKind: FeedPostKind | null;
	creditedEntityIds: readonly string[];
	realmId: string | null;
	subjectId: string | null;
	rootPostId: string | null;
	parentPostId: string | null;
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
					and ${unitFollow.targetReferenceId} = ${referenceValueIdForNativeId(sql`candidate_realm.realm_id`)}
			) then 0 else 1 end,`
			: sql``;
	return sql<string | null>`(
		select candidate_realm.realm_id from (select realm_id,updated_at from realm_unit candidate_realm
		where candidate_realm.unit_id = ${feedUnit.id}
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
        order by candidate_realm.updated_at desc,candidate_realm.realm_id desc limit 32
        ) candidate_realm
		order by
			${followedRealmOrder}
			candidate_realm.updated_at desc, candidate_realm.realm_id desc
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
		? and(eq(unitBestScore.snapshotId, input.snapshotId), eq(unitBestScore.unitId, feedUnit.id))
		: sql`false`;
	const rows = await database
		.select({
			id: feedUnit.id,
			owner: feedUnit.owner,
			shape: feedUnit.shape,
			postKind: post.kind,
            creditedEntityIds:sql<string[]>`array(
             select distinct credited_entity_id::text from (
              select credited_entity_id from credit_attribution where source_unit_id=${feedUnit.id}
              order by position,id limit 32
             ) bounded order by credited_entity_id::text
            )`,
			realmId: selectedRealmId,
			subjectId: post.subjectUnitId,
			rootPostId: postReply.rootPostId,
			parentPostId: postReply.parentPostId,
			createdAt: feedUnit.createdAt,
			updatedAt: feedUnit.updatedAt,
			bestScore: sql<number>`coalesce(${unitBestScore.score}, 0)`,
		})
		.from(unitStatesForIds(input.ids, "search_unit"))
		.leftJoin(post, eq(post.id, feedUnit.id))
		.leftJoin(postReply, eq(postReply.postId, feedUnit.id))
		.leftJoin(unitBestScore, snapshotJoin)
		.where(
			and(
				inArray(feedUnit.id, input.ids),
				getFeedEligibilityCondition(input.viewer, input.query, input.asOf, input.anchorId),
			),
		);
	return rows.flatMap((row): FeedRankingCandidate[] => {
		const kind =
			row.owner === "post" && isFeedPostKind(row.postKind)
				? { owner: "post" as const, postKind: row.postKind }
				: isFeedUnitOwner(row.owner)
					? { owner: row.owner, postKind: null }
					: null;
		if (!kind) return [];
		if (row.bestScore > 0 && !input.sources.reason.has(row.id))
			input.sources.reason.set(row.id, "popular_now");
		return [
			{
				id: row.id,
				...kind,
				shape: row.shape,
				creditedEntityIds: row.creditedEntityIds,
				realmId: row.realmId,
				subjectId: row.subjectId,
				rootPostId: row.rootPostId,
				parentPostId: row.parentPostId,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				bestScore: row.bestScore,
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
			id: feedUnit.id,
			owner: feedUnit.owner,
			shape: feedUnit.shape,
			postKind: post.kind,
			subjectId: post.subjectUnitId,
			rootPostId: postReply.rootPostId,
			parentPostId: postReply.parentPostId,
			language: resolvedUnitLocalizationLanguage(feedUnit.id, displayLanguages, allowedLanguages),
			title: unitLocalization.title,
			summary: unitLocalization.summary,
			coverAssetId: resolvedUnitLocalizationImageAssetId(
				feedUnit.id,
				"cover",
				displayLanguages,
				allowedLanguages,
			),
			avatar: resolvedUnitLocalizationAvatar(feedUnit.id, displayLanguages, allowedLanguages),
			bannerAssetId: resolvedUnitLocalizationImageAssetId(
				feedUnit.id,
				"banner",
				displayLanguages,
				allowedLanguages,
			),
			latestRevisionId: unitRevisionHead.revisionId,
			createdAt: feedUnit.createdAt,
			updatedAt: feedUnit.updatedAt,
			contentSpoilerLevel: sql<number>`coalesce((
				select manifest.spoiler_level
				from (values
					('019b76da-a800-7370-8000-000000000001'::uuid, 0),
					('019b76da-a800-7370-8000-000000000002'::uuid, 1),
					('019b76da-a800-7370-8000-000000000003'::uuid, 2)
				) manifest(tag_id, spoiler_level)
				join ${unitTag} content_label
					on content_label.tag_id = manifest.tag_id
					and content_label.unit_id = ${feedUnit.id}
			), 0)`,
			contentNsfw: sql<boolean>`exists(
				select 1 from ${unitTag} content_label
				where content_label.unit_id = ${feedUnit.id}
					and content_label.tag_id = '019b76da-a800-7370-8000-000000000004'::uuid
			)`,
		})
		.from(unitStatesForIds(pageIds, "search_unit"))
		.leftJoin(post, eq(post.id, feedUnit.id))
		.leftJoin(postReply, eq(postReply.postId, feedUnit.id))
		.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, feedUnit.id))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, feedUnit.id),
				eq(
					unitLocalization.language,
					resolvedUnitLocalizationLanguage(feedUnit.id, displayLanguages, allowedLanguages),
				),
			),
		)
		.where(and(inArray(feedUnit.id, pageIds), getFeedEligibilityCondition(viewer, scope, asOf)));
	if (!rows.length) return [];
	const [viewerDisplayPreference] = viewer.profileId
		? await database
				.select({
					alwaysShowSpoilers: accountPreference.alwaysShowSpoilers,
					alwaysShowNsfw: accountPreference.alwaysShowNsfw,
				})
				.from(accountPreference)
				.where(eq(accountPreference.authUserId, selfAuthUserIdForEntity(viewer.profileId)))
				.limit(1)
		: [];
	const validIds = rows.map(({ id }) => id);
	const presentations = await getPublicUnitSummariesByIds(validIds, displayLanguages);
	const rootPostIds = rows
		.filter(({ owner, postKind }) => owner === "post" && postKind !== "reply")
		.map(({ id }) => id);
	const replyIds = rows.filter(({ postKind }) => postKind === "reply").map(({ id }) => id);
	const reviewIds = rows.filter(({ postKind }) => postKind === "review").map(({ id }) => id);
	const wikiIds = rows.filter(({ postKind }) => postKind === "wiki").map(({ id }) => id);
	const tagIds = rows.filter(({ owner }) => owner === "tag").map(({ id }) => id);
	const scopedRealmIds = [...new Set(page.flatMap(({ realmId }) => (realmId ? [realmId] : [])))];
	const collectionIds = rows
		.filter(({ owner }) => owner === "collection")
		.map(({ id }) => id);
	const realmIds = rows.filter(({ owner }) => owner === "realm").map(({ id }) => id);
	const ratedWorkIds = rows
		.filter(
			(row): row is typeof row & { owner: FeedUnitOwner } =>
				isFeedUnitOwner(row.owner) && isFeedRatedWorkOwner(row.owner),
		)
		.map(({ id }) => id);
	const subjectIds = [...new Set(rows.flatMap(({ subjectId }) => (subjectId ? [subjectId] : [])))];
	const scoreTargetIds = [...new Set([...ratedWorkIds, ...subjectIds])];
	const globalScoreRealmId = OfficialRealmUnitIds.score;
	const scoreRealmIds = [...new Set([viewer.defaultScoreRealmId, globalScoreRealmId])];
	const rootIds = [...new Set(rows.flatMap(({ rootPostId }) => (rootPostId ? [rootPostId] : [])))];
	// Zone aggregates bind these lookups to one PostgreSQL transaction client.
	const availableLanguageRows = await database
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
		);
	const rootReplyCounts = await (rootPostIds.length
		? database
				.select({
					id: postReplyStat.postId,
					count: postReplyStat.visibleDescendantCount,
				})
				.from(postReplyStat)
				.where(inArray(postReplyStat.postId, rootPostIds))
		: []);
	const childReplyCounts = await (replyIds.length
		? database
				.select({
					id: postReplyStat.postId,
					count: postReplyStat.visibleDirectCount,
				})
				.from(postReplyStat)
				.where(inArray(postReplyStat.postId, replyIds))
		: []);
	const reactions = await database
		.select({
			unitId: unitReactionGlobalStat.unitId,
			reaction: unitReactionGlobalStat.reaction,
			count: unitReactionGlobalStat.reactionCount,
		})
		.from(unitReactionGlobalStat)
		.where(inArray(unitReactionGlobalStat.unitId, validIds));
	const viewerReactions = await (viewer.profileId
		? database
				.select({
					unitId: unitReaction.unitId,
					realmId: unitReaction.realmId,
					reaction: unitReaction.reaction,
				})
				.from(unitReaction)
				.where(
					and(eq(unitReaction.profileId, viewer.profileId), inArray(unitReaction.unitId, validIds)),
				)
		: []);
	const subjectRows = await (subjectIds.length
		? database
				.select({
					id: feedUnit.id,
					owner: feedUnit.owner,
					shape: feedUnit.shape,
					coverAssetId: resolvedUnitLocalizationImageAssetId(feedUnit.id, "cover", displayLanguages),
				})
				.from(unitStatesForIds(subjectIds, "search_unit"))
				.where(
					and(
						eq(feedUnit.status, "published"),
						eq(feedUnit.visibility, "public"),
						eq(feedUnit.moderationStatus, "approved"),
						isNull(feedUnit.deletedAt),
						getContentRatingCondition(
							contentRatingPolicyFromAllowlist(viewer.contentRatings),
							feedUnit.contentRating,
						),
					),
				)
		: []);
	const scoreRows = await (scoreTargetIds.length
		? database
				.select({
					unitId: scoreStat.unitId,
					realmId: scoreStat.realmId,
					totalScore: scoreStat.totalScore,
					totalCount: scoreStat.totalCount,
				})
				.from(scoreStat)
				.where(
					and(inArray(scoreStat.unitId, scoreTargetIds), inArray(scoreStat.realmId, scoreRealmIds)),
				)
		: []);
	const scoreRealmRows = await database
		.select({
			id: feedUnit.id,
			title: resolvedUnitLocalizationTitle(feedUnit.id, displayLanguages),
		})
		.from(unitStatesForIds(scoreRealmIds, "search_unit"))
		.where(inArray(feedUnit.id, scoreRealmIds));
	const rootRows = await (rootIds.length
		? database
				.select({
					rootPostId: post.id,
					title: unitLocalization.title,
					subjectId: post.subjectUnitId,
				})
				.from(post)
				.innerJoinLateral(unitStateRelation(post.id, "search_unit"), sql`true`)
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
		: []);
	const collectionCounts = await (collectionIds.length
		? database
				.select({
					collectionId: collectionStat.collectionId,
					count: collectionStat.itemCount,
				})
				.from(collectionStat)
				.where(inArray(collectionStat.collectionId, collectionIds))
		: []);
	const realmMemberCounts = await (realmIds.length
		? database
				.select({
					realmId: realmStat.realmId,
					count: realmStat.activeMemberCount,
				})
				.from(realmStat)
				.where(inArray(realmStat.realmId, realmIds))
		: []);
	const realmTagContextRows = await (wikiIds.length
		? database
				.select({
					contextPostId: realmTagContext.contextPostId,
					realmId: realmTagContext.realmId,
					tagId: realmTagContext.tagId,
					language: resolvedUnitLocalizationLanguage(feedRealmContextTagUnit.id, displayLanguages),
					title: resolvedUnitLocalizationTitle(feedRealmContextTagUnit.id, displayLanguages),
					avatar: resolvedUnitLocalizationAvatar(feedRealmContextTagUnit.id, displayLanguages),
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
				.innerJoin(feedRealmContextTagUnit, eq(feedRealmContextTagUnit.id, realmTagContext.tagId))
				.where(
					and(
						inArray(realmTagContext.contextPostId, wikiIds),
						getUnitReadCondition(viewer.profileId, {}, feedRealmContextTagUnit),
					),
				)
		: []);
	const realmTagUnitContextRows = await (tagIds.length && scopedRealmIds.length
		? database
				.select({
					realmId: realmTagContext.realmId,
					tagId: realmTagContext.tagId,
					contextPostId: realmTagContext.contextPostId,
					language: resolvedUnitLocalizationLanguage(feedRealmContextPostUnit.id, displayLanguages),
					summary: resolvedUnitLocalizationSummary(feedRealmContextPostUnit.id, displayLanguages),
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
		: []);
	const reviewScores = await (reviewIds.length
		? database
				.select({
					postId: postScore.postId,
					scoreId: score.id,
					realmId: score.realmId,
					realmTitle: resolvedUnitLocalizationTitle(feedReviewScoreRealm.id, displayLanguages),
					value: score.value,
					position: postScore.position,
				})
				.from(postScore)
				.innerJoin(score, eq(score.id, postScore.scoreId))
				.innerJoin(
					accountPreference,
					eq(accountPreference.authUserId, selfAuthUserIdForEntity(score.profileId)),
				)
				.innerJoinLateral(feedReviewScoreTargetUnit, sql`true`)
				.innerJoin(feedReviewScoreRealm, eq(feedReviewScoreRealm.id, score.realmId))
				.where(
					and(
						inArray(postScore.postId, reviewIds),
						getProfileActivityReadCondition({
							ownerProfileId: score.profileId,
							categoryVisibility: accountPreference.scoreVisibility,
							itemVisibility: score.visibility,
							viewerProfileId: viewer.profileId,
							surface: "linked",
						}),
						getUnitReadCondition(viewer.profileId, {}, feedReviewScoreTargetUnit),
						getUnitReadCondition(viewer.profileId, {}, feedReviewScoreRealm),
					),
				)
				.orderBy(asc(postScore.postId), asc(postScore.position), asc(score.id))
		: []);
	const attributions = await getAttributionSummariesByUnitIds(validIds, displayLanguages, {
		maximumPerSourceUnit: MaximumFeedAttributionsPerItem,
	});
	const rootAttributions = await getAttributionSummariesByUnitIds(rootIds, displayLanguages, {
		maximumPerSourceUnit: MaximumFeedAttributionsPerItem,
	});
	const realmContexts = await getFeedRealmContextsByUnitIds(page, displayLanguages);
 const subjectPresentations = await getPublicUnitSummariesByIds(subjectRows.map(row => row.id), displayLanguages);
 const subjects = new Map(subjectRows.flatMap(subject => {
  const presentation = subjectPresentations.get(subject.id);
  return presentation ? [[subject.id, {...presentation, cover: presentImageAsset(subject.coverAssetId,"cover")} ] as const] : [];
 }));
	const rowMap = new Map(rows.map((row) => [row.id, row]));
	const availableLanguagesByUnitId = new Map<string, string[]>();
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
		collectionCounts.map((row) => [
			row.collectionId,
			toSafeInteger(row.count, "collection item count"),
		]),
	);
	const realmMemberCount = new Map(
		realmMemberCounts.map((row) => [
			row.realmId,
			toSafeInteger(row.count, "Realm active member count"),
		]),
	);
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
        const presentation = presentations.get(row.id);
        if (!presentation) return [];
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
			language: presentation.language,
			availableLanguages: [...new Set([...(availableLanguagesByUnitId.get(row.id) ?? []), ...(presentation.language ? [presentation.language] : [])])],
			shape: row.shape,
			attributions: attributions.get(row.id) ?? [],
			realmId: ranked.realmId,
			realms: prioritizeFeedRealmContexts(realmContexts.get(row.id) ?? [], ranked.realmId),
			title: presentation.title,
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
		if (isFeedUnitOwner(row.owner)) {
			const unitItem = {
				...common,
				itemType: "unit" as const,
				postKind: null,
				summary: presentation.summary,
				cover: presentImageAsset(row.coverAssetId, "cover"),
				collection:
					row.owner === "collection"
						? {
								directItemCount: collectionDirectItemCount.get(row.id) ?? 0,
							}
						: null,
			};
			if (isFeedRatedWorkOwner(row.owner))
				return [
					{
						...unitItem,
						owner: row.owner,
						presentation: {
							kind: "rated-work",
							scores: scoresFor(row.id),
						},
					},
				];
			if (row.owner === "realm" || row.owner === "zone" || row.owner === "tag")
				return [
					{
						...unitItem,
						owner: row.owner,
						presentation: {
							kind: "identity",
							avatar: presentAvatar(row.avatar),
							banner: presentImageAsset(row.bannerAssetId, "banner"),
							memberCount: row.owner === "realm" ? (realmMemberCount.get(row.id) ?? 0) : null,
							realmTagContext:
								row.owner === "tag" && ranked.realmId
									? (realmTagContextByRealmTag.get(`${ranked.realmId}:${row.id}`) ?? null)
									: null,
						},
					},
				];
			return [
				{
					...unitItem,
					owner: row.owner,
					presentation: { kind: "general" },
				},
			];
		}
		if (row.owner !== "post" || !isFeedPostKind(row.postKind)) return [];
		const subject = row.subjectId ? subjects.get(row.subjectId) : undefined;
		if (row.postKind === "excerpt" && !subject) return [];
		const contentSpoilerLevel = requireContentSpoilerLevel(row.contentSpoilerLevel);
		const postItem = {
			...common,
			itemType: "post" as const,
			owner: "post" as const,
			summary:
				(row.contentSpoilerLevel > 0 && !viewerDisplayPreference?.alwaysShowSpoilers) ||
				(row.contentNsfw && !viewerDisplayPreference?.alwaysShowNsfw)
					? null
					: presentation.summary,
			cover: presentImageAsset(row.coverAssetId, "cover"),
			subjectId: row.subjectId,
			rootPostId: row.rootPostId,
			parentPostId: row.parentPostId,
			contentSpoiler: {
				level: contentSpoilerLevel,
				concealed: row.contentSpoilerLevel > 0 && !viewerDisplayPreference?.alwaysShowSpoilers,
			},
			contentNsfw: {
				labelled: row.contentNsfw,
				concealed: row.contentNsfw && !viewerDisplayPreference?.alwaysShowNsfw,
			},
			replyCount:
				row.postKind === "reply" ? (childCount.get(row.id) ?? 0) : (rootCount.get(row.id) ?? 0),
			title: presentation.title,
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

export default new Elysia({ prefix: "/feed" }).post(
	"/query",
	{
		body: FeedRequest,
		response: {
			[StatusCodes.OK]: FeedResponse,
			[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidFeedCursor", "InvalidFeedFilter"]),
			[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidSearch"]),
			[StatusCodes.SERVICE_UNAVAILABLE]: toApiErrorResponse(["SearchUnavailable"]),
		},
		detail: { summary: "Ranked realm feed", tags: ["Feed"] },
	},
	async ({ body, request }) => {
		if (body.filter)
			try {
				assertUnitFilter(body.filter);
			} catch {
				throw new InvalidFeedFilter();
			}
		const identity = await resolveIdentity(request, "unit:read");
		const viewer = await resolveRecommendationViewer(identity.entity?.id);
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
		validateCursor(
			cursor,
			body,
			viewer.personalized,
			filterLanguages,
			localizationLanguages,
			viewer.contentRatings,
		);
		const baseScope: FeedEligibilityScope = {
			...(body.filter?.where ? { filter: body.filter.where } : {}),
			...(contentKinds?.length ? { content: contentKinds } : {}),
			...(filterLanguages.length ? { languages: filterLanguages } : {}),
			...(localizationLanguages.length ? { localizationLanguages } : {}),
			...(simpleSelection?.realmIds.length ? { realmIds: simpleSelection.realmIds } : {}),
		};
		const sort = body.sort ?? "best";
		const limit = body.limit ?? 20;
		const scope: FeedEligibilityScope = baseScope;
		const asOf = cursor ? new Date(cursor.asOf) : new Date();
		const snapshot = cursor?.snapshotId
			? await resolveRecommendationSnapshot(cursor.snapshotId)
			: cursor
				? null
				: await resolveRecommendationSnapshot();
		if (cursor?.snapshotId && !snapshot) throw new InvalidFeedCursor();
		const snapshotContext = snapshot ?? fallbackRecommendationSnapshot;
		if (cursor && cursor.policyVersion !== snapshotContext.policyVersion)
			throw new InvalidFeedCursor();
		let searchSelection: FeedSearchSelection;
		try {
			searchSelection = await resolveFeedSearchSelection({
				content: baseScope.content,
				filter: baseScope.filter,
				profileId: viewer.profileId,
				contentRatings: viewer.contentRatings,
				query: body.filter && "search" in body.filter ? body.filter.search.query : "",
				sort,
				limit,
				eligibilityCondition: getFeedEligibilityCondition(viewer, scope, asOf),
                snapshotId:snapshotContext.id,
				...(cursor ? { position: cursor.searchPosition } : {}),
			});
		} catch (cause) {
			if (cause instanceof InvalidSearch || cause instanceof SearchUnavailable) throw cause;
			throw new SearchUnavailable(cause);
		}
		const sources: CandidateSources = {
			ids: [...searchSelection.ids],
			reason: new Map(
				sort === "new" ? searchSelection.ids.map((id) => [id, "new_and_relevant"] as const) : [],
			),
		};
		const candidates = await getFeedRankingCandidates({
			ids: sources.ids,
			sources,
			viewer,
			query: scope,
			snapshotId: snapshotContext.id,
			asOf,
		});
		const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
		const page = searchSelection.ids.flatMap((id) => {
			const candidate = candidateById.get(id);
			return candidate ? [candidate] : [];
		});
		const positionOffset = cursor?.positionOffset ?? 0;
		const requestId = crypto.randomUUID();
		const items = await hydrateFeedItems(page, viewer, scope, asOf, {
			kind: "recommendation",
			reasons: sources.reason,
			surface: "home_feed",
			requestId,
			positionOffset,
			policyVersion: snapshotContext.policyVersion,
		});
		const encodedNextCursor = searchSelection.nextPosition
			? Buffer.from(
					JSON.stringify({
						v: 1,
						sort,
						filterHash: body.filter
							? createHash("sha256").update(canonicalUnitFilter(body.filter)).digest("hex")
							: null,
						filterLanguages,
						localizationLanguages,
						contentRatings: [...viewer.contentRatings],
						personalized: viewer.personalized,
						snapshotId: snapshotContext.id,
						policyVersion: snapshotContext.policyVersion,
						limit,
						asOf: asOf.toISOString(),
						searchPosition: toFeedSearchPosition(searchSelection.nextPosition),
						positionOffset: positionOffset + page.length,
					}),
				).toString("base64url")
			: null;
		const continuation = resolveFeedPageContinuation(items, encodedNextCursor);
		return {
			items,
			total: createFeedTotal({
				candidates: page,
				coverage: searchSelection.coverage,
				searchKind: searchSelection.kind,
				positionOffset,
			}),
			nextCursor: continuation.cursor,
		};
	},
);
