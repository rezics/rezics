import {
	BlockPath,
	PortableTextDocument,
	encodeBlockPath,
	isDocument,
	type BlockPath as BlockPathValue,
} from "@rezics/block";
import { SearchSortValues, type SearchSort } from "@rezics/filter";
import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";
import type {
	PostApiSearchZonesByZoneIdDockBlockExecutionsStatus200,
	PostApiSearchZonesByZoneIdDockFeedBlockExecutionsStatus200,
} from "@rezics/openapi-tanstack-query";

type SearchExecution = PostApiSearchZonesByZoneIdDockBlockExecutionsStatus200;
export interface ZoneAggregateSearchHit {
	readonly id: string;
	readonly category: string;
	readonly kind: string;
	readonly title: string | null;
	readonly name?: string | null;
	readonly summary: string | null;
}
export type ZoneAggregateFeedItem =
	PostApiSearchZonesByZoneIdDockFeedBlockExecutionsStatus200["items"][number];
export type ZoneAggregateFacet = NonNullable<SearchExecution["facets"]>[number];

export interface ZoneAggregateCount {
	readonly kind: "exact" | "lower-bound";
	readonly value: number;
}

export interface ZoneAggregateSortAdvisory {
	readonly code: "PersistedSortUnavailable";
	readonly requestedSort: SearchSort;
	readonly resolvedSort: SearchSort;
}

export interface ZoneAggregateSelectedUnit {
	readonly id: string;
	readonly kind: string;
	readonly language: ContentLanguage;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: unknown;
}

interface ZoneAggregateOkBase {
	readonly kind: "ok";
	readonly blockType: "unit-list" | "feed";
	readonly nextCursor?: string;
	readonly advisory?: ZoneAggregateSortAdvisory;
	readonly facets?: readonly ZoneAggregateFacet[];
	readonly total?: ZoneAggregateCount;
	readonly selected?: ZoneAggregateSelectedUnit;
	readonly selectionSeed?: string;
}

export interface ZoneAggregateSearchHitResult extends ZoneAggregateOkBase {
	readonly blockType: "unit-list";
	readonly itemKind: "search-hit";
	readonly items: readonly ZoneAggregateSearchHit[];
}

export interface ZoneAggregateFeedItemResult extends ZoneAggregateOkBase {
	readonly itemKind: "feed-item";
	readonly items: readonly ZoneAggregateFeedItem[];
}

export type ZoneAggregateOkResult = ZoneAggregateSearchHitResult | ZoneAggregateFeedItemResult;

export type ZoneAggregateResult =
	| ZoneAggregateOkResult
	| { readonly kind: "error"; readonly code: string }
	| { readonly kind: "hidden" }
	| { readonly kind: "skipped"; readonly reason: "budget" | "inactive-tab" };

export interface ZoneAggregateResultEntry {
	readonly path: BlockPathValue;
	readonly outcome: ZoneAggregateResult;
}

export interface ZonePageAggregateResponse {
	readonly pageRevision: string;
	readonly page: { readonly results: readonly ZoneAggregateResultEntry[] };
	readonly dock?: { readonly results: readonly ZoneAggregateResultEntry[] };
}

export type ZoneAggregateBlockState =
	| ZoneAggregateResult
	| { readonly kind: "legacy" }
	| { readonly kind: "pending" };

const UuidPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const MaximumPageAggregateResults = 24;
const MaximumDockAggregateResults = 6;
const MaximumEagerItems = 20;
const MaximumCursorLength = 4_096;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
	return typeof value === "string" && UuidPattern.test(value);
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === "string";
}

function isNonNegativeInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNullableUuid(value: unknown): value is string | null {
	return value === null || isUuid(value);
}

function isImage(value: unknown): boolean {
	return value === null || (isRecord(value) && isUuid(value.id) && typeof value.url === "string");
}

function isAvatar(value: unknown): boolean {
	if (value === null) return true;
	if (!isRecord(value) || typeof value.type !== "string") return false;
	if (value.type === "image") return isRecord(value.image) && isImage(value.image);
	if (value.type === "emoji") return typeof value.emoji === "string" && value.emoji.length <= 64;
	return (
		value.type === "icon" &&
		isRecord(value.icon) &&
		value.icon.provider === "font-awesome" &&
		typeof value.icon.prefix === "string" &&
		typeof value.icon.name === "string" &&
		value.icon.name.length <= 128
	);
}

function isSlugAddress(value: unknown): boolean {
	return (
		value === null ||
		(isRecord(value) &&
			typeof value.slug === "string" &&
			isUuid(value.scopeUnitId) &&
			Array.isArray(value.canonicalPath) &&
			value.canonicalPath.every((part) => typeof part === "string"))
	);
}

function isUnitSummary(value: unknown): boolean {
	return (
		isRecord(value) &&
		isUuid(value.id) &&
		typeof value.kind === "string" &&
		typeof value.language === "string" &&
		isContentLanguage(value.language) &&
		isSlugAddress(value.slugAddress) &&
		isNullableString(value.title) &&
		isNullableString(value.summary) &&
		isAvatar(value.avatar)
	);
}

function isSelectedUnit(value: unknown): value is ZoneAggregateSelectedUnit {
	return (
		isRecord(value) &&
		isUuid(value.id) &&
		typeof value.kind === "string" &&
		typeof value.language === "string" &&
		isContentLanguage(value.language) &&
		isNullableString(value.title) &&
		isNullableString(value.summary) &&
		isAvatar(value.avatar)
	);
}

function isAttribution(value: unknown): boolean {
	return (
		isRecord(value) &&
		isUuid(value.id) &&
		typeof value.role === "string" &&
		typeof value.position === "string" &&
		isUnitSummary(value.creditedUnit)
	);
}

function isRealmSummary(value: unknown): boolean {
	return (
		isRecord(value) &&
		isUuid(value.id) &&
		typeof value.language === "string" &&
		isSlugAddress(value.slugAddress) &&
		isNullableString(value.title) &&
		isNullableString(value.summary) &&
		isAvatar(value.avatar)
	);
}

function isTracking(value: unknown): boolean {
	return (
		value === null ||
		(isRecord(value) &&
			isUuid(value.requestId) &&
			typeof value.surface === "string" &&
			isNonNegativeInteger(value.position) &&
			typeof value.policyVersion === "string" &&
			value.policyVersion.length >= 1 &&
			value.policyVersion.length <= 64 &&
			typeof value.signature === "string" &&
			/^[A-Za-z0-9_-]{43}$/.test(value.signature))
	);
}

function isScore(value: unknown): boolean {
	return (
		isRecord(value) &&
		isUuid(value.realmId) &&
		isNullableString(value.realmTitle) &&
		isNonNegativeInteger(value.totalScore) &&
		value.totalScore >= 1 &&
		isNonNegativeInteger(value.totalCount) &&
		value.totalCount >= 1
	);
}

function isScoreCandidates(value: unknown): boolean {
	return (
		isRecord(value) &&
		(value.preferred === null || isScore(value.preferred)) &&
		(value.global === null || isScore(value.global))
	);
}

function isFeedItemBase(value: Record<string, unknown>): boolean {
	return (
		isUuid(value.id) &&
		isNullableString(value.language) &&
		Array.isArray(value.availableLanguages) &&
		value.availableLanguages.every((language) => typeof language === "string") &&
		Array.isArray(value.attributions) &&
		value.attributions.every(isAttribution) &&
		isNullableUuid(value.realmId) &&
		Array.isArray(value.realms) &&
		value.realms.every(isRealmSummary) &&
		isNullableString(value.title) &&
		typeof value.createdAt === "string" &&
		typeof value.updatedAt === "string" &&
		isRecord(value.reactions) &&
		Number.isSafeInteger(value.reactions.upvote) &&
		Number.isSafeInteger(value.reactions.downvote) &&
		isNullableString(value.viewerReaction) &&
		(value.recommendationReason === null || typeof value.recommendationReason === "string") &&
		isTracking(value.tracking)
	);
}

function isUnitPresentation(value: unknown): boolean {
	if (!isRecord(value)) return false;
	if (value.kind === "general") return true;
	if (value.kind === "rated-work") return isScoreCandidates(value.scores);
	return (
		value.kind === "identity" &&
		isAvatar(value.avatar) &&
		isImage(value.banner) &&
		(value.memberCount === null || isNonNegativeInteger(value.memberCount)) &&
		(value.realmTagContext === null ||
			(isRecord(value.realmTagContext) &&
				isUuid(value.realmTagContext.realmId) &&
				isUuid(value.realmTagContext.contextPostId) &&
				isNullableString(value.realmTagContext.language) &&
				isNullableString(value.realmTagContext.summary)))
	);
}

function isFeedUnit(value: Record<string, unknown>): value is ZoneAggregateFeedItem {
	return (
		isFeedItemBase(value) &&
		value.itemType === "unit" &&
		typeof value.unitKind === "string" &&
		value.postKind === null &&
		isNullableString(value.summary) &&
		isImage(value.cover) &&
		(value.collection === null ||
			(isRecord(value.collection) && isNonNegativeInteger(value.collection.directItemCount))) &&
		isUnitPresentation(value.presentation)
	);
}

function isReplyContext(value: unknown): boolean {
	return (
		value === null ||
		(isRecord(value) &&
			isUuid(value.rootPostId) &&
			isNullableString(value.title) &&
			Array.isArray(value.attributions) &&
			value.attributions.every(isAttribution) &&
			isNullableUuid(value.subjectId))
	);
}

function isSubject(value: unknown): boolean {
	return (
		value === null ||
		(isRecord(value) &&
			isUuid(value.id) &&
			typeof value.type === "string" &&
			typeof value.language === "string" &&
			isNullableString(value.title) &&
			isNullableString(value.summary) &&
			isImage(value.cover) &&
			isScoreCandidates(value.scores))
	);
}

function isReviewScores(value: unknown): boolean {
	return (
		Array.isArray(value) &&
		value.every(
			(score) =>
				isRecord(score) &&
				isUuid(score.scoreId) &&
				isUuid(score.realmId) &&
				isNullableString(score.realmTitle) &&
				isNonNegativeInteger(score.value) &&
				score.value >= 1 &&
				score.value <= 10,
		)
	);
}

function isWikiContext(value: unknown): boolean {
	return (
		value === null ||
		(isRecord(value) &&
			isUuid(value.realmId) &&
			isRecord(value.tag) &&
			isUuid(value.tag.id) &&
			typeof value.tag.language === "string" &&
			isNullableString(value.tag.title) &&
			isAvatar(value.tag.avatar))
	);
}

function isFeedPost(value: Record<string, unknown>): value is ZoneAggregateFeedItem {
	if (
		!isFeedItemBase(value) ||
		value.itemType !== "post" ||
		value.unitKind !== "post" ||
		typeof value.postKind !== "string" ||
		!isNullableString(value.summary) ||
		!isImage(value.cover) ||
		!isNullableUuid(value.subjectId) ||
		!isNullableUuid(value.rootPostId) ||
		!isNullableUuid(value.parentPostId) ||
		!(value.body === null || isDocument(PortableTextDocument, value.body)) ||
		!Number.isSafeInteger(value.replyCount) ||
		!isNullableUuid(value.latestRevisionId) ||
		!isReplyContext(value.replyContext) ||
		!isSubject(value.subject)
	)
		return false;
	if (value.postKind === "review") return isReviewScores(value.scores);
	if (value.postKind === "wiki") return isWikiContext(value.realmTagContext);
	return ["post", "reply", "excerpt", "chapter", "picture"].includes(value.postKind);
}

function isFeedItem(value: unknown): value is ZoneAggregateFeedItem {
	return isRecord(value) && (isFeedUnit(value) || isFeedPost(value));
}

function isSearchHit(value: unknown): value is ZoneAggregateSearchHit {
	return (
		isRecord(value) &&
		isUuid(value.id) &&
		typeof value.category === "string" &&
		typeof value.kind === "string" &&
		isNullableString(value.title) &&
		(value.name === undefined || isNullableString(value.name)) &&
		isNullableString(value.summary)
	);
}

function isFacet(value: unknown): value is ZoneAggregateFacet {
	return (
		isRecord(value) &&
		(value.controlKey === undefined || typeof value.controlKey === "string") &&
		typeof value.field === "string" &&
		Array.isArray(value.options) &&
		value.options.every(
			(option) =>
				isRecord(option) &&
				typeof option.value === "string" &&
				isRecord(option.count) &&
				(option.count.kind === "exact" || option.count.kind === "lower-bound") &&
				isNonNegativeInteger(option.count.value),
		)
	);
}

function parseCount(value: unknown): ZoneAggregateCount | undefined {
	if (!isRecord(value) || (value.kind !== "exact" && value.kind !== "lower-bound")) return;
	const numeric = typeof value.value === "string" ? Number(value.value) : value.value;
	return isNonNegativeInteger(numeric) ? { kind: value.kind, value: numeric } : undefined;
}

function isSearchSort(value: unknown): value is SearchSort {
	return typeof value === "string" && SearchSortValues.some((sort) => sort === value);
}

function parseSortAdvisory(value: unknown): ZoneAggregateSortAdvisory | undefined {
	if (value === undefined) return;
	if (
		!isRecord(value) ||
		value.code !== "PersistedSortUnavailable" ||
		!isSearchSort(value.requestedSort) ||
		!isSearchSort(value.resolvedSort)
	)
		throw new Error("Zone aggregate result has an invalid sort advisory");
	return {
		code: "PersistedSortUnavailable",
		requestedSort: value.requestedSort,
		resolvedSort: value.resolvedSort,
	};
}

function parseFacets(value: unknown): readonly ZoneAggregateFacet[] | undefined {
	if (value === undefined) return;
	if (!Array.isArray(value) || !value.every(isFacet))
		throw new Error("Zone aggregate result has invalid facets");
	return value;
}

function parseOkResult(value: Record<string, unknown>): ZoneAggregateOkResult {
	if (value.blockType !== "unit-list" && value.blockType !== "feed")
		throw new Error("Zone aggregate result has an invalid block type");
	if (value.nextCursor !== undefined) {
		if (
			typeof value.nextCursor !== "string" ||
			value.nextCursor.length < 1 ||
			value.nextCursor.length > MaximumCursorLength
		)
			throw new Error("Zone aggregate result has an invalid continuation cursor");
	}
	const facets = parseFacets(value.facets);
	const total = value.total === undefined ? undefined : parseCount(value.total);
	if (value.total !== undefined && !total)
		throw new Error("Zone aggregate result has an invalid count");
	if (value.selected !== undefined && !isSelectedUnit(value.selected))
		throw new Error("Zone aggregate result has an invalid selected Unit");
	if (
		value.selectionSeed !== undefined &&
		(typeof value.selectionSeed !== "string" ||
			value.selectionSeed.length < 1 ||
			value.selectionSeed.length > 128)
	)
		throw new Error("Zone aggregate result has an invalid selection seed");
	const advisory = parseSortAdvisory(value.advisory);
	if (!Array.isArray(value.items) || value.items.length > MaximumEagerItems)
		throw new Error("Zone aggregate result has an invalid item page");
	const common = {
		kind: "ok" as const,
		...(value.nextCursor === undefined ? {} : { nextCursor: value.nextCursor }),
		...(advisory ? { advisory } : {}),
		...(facets === undefined ? {} : { facets }),
		...(total ? { total } : {}),
		...(value.selected === undefined ? {} : { selected: value.selected }),
		...(value.selectionSeed === undefined ? {} : { selectionSeed: value.selectionSeed }),
	};
	if (value.itemKind === "search-hit") {
		if (value.blockType !== "unit-list" || !value.items.every(isSearchHit))
			throw new Error("Zone aggregate result has invalid Search items");
		return { ...common, blockType: "unit-list", itemKind: "search-hit", items: value.items };
	}
	if (value.itemKind !== "feed-item" || !value.items.every(isFeedItem))
		throw new Error("Zone aggregate result has invalid Feed items");
	return value.blockType === "unit-list"
		? { ...common, blockType: "unit-list", itemKind: "feed-item", items: value.items }
		: { ...common, blockType: "feed", itemKind: "feed-item", items: value.items };
}

function parseResult(value: unknown): ZoneAggregateResult {
	if (!isRecord(value)) throw new Error("Zone aggregate result must be an object");
	if (value.kind === "skipped") {
		if (value.reason !== "budget" && value.reason !== "inactive-tab")
			throw new Error("Zone aggregate skipped result has an invalid reason");
		return { kind: "skipped", reason: value.reason };
	}
	if (value.kind === "hidden") return { kind: "hidden" };
	if (value.kind === "error") {
		if (typeof value.code !== "string" || value.code.length < 1 || value.code.length > 128)
			throw new Error("Zone aggregate error has an invalid code");
		return { kind: "error", code: value.code };
	}
	if (value.kind === "ok") return parseOkResult(value);
	throw new Error("Zone aggregate result has an invalid discriminator");
}

export function parseZonePageAggregateResponse(value: unknown): ZonePageAggregateResponse {
	if (!isRecord(value) || !isUuid(value.pageRevision))
		throw new Error("Zone aggregate response is invalid");

	const parseSurface = (
		surface: unknown,
		maximumResults: number,
	): { readonly results: readonly ZoneAggregateResultEntry[] } => {
		if (!isRecord(surface) || !Array.isArray(surface.results))
			throw new Error("Zone aggregate surface is invalid");
		if (surface.results.length > maximumResults)
			throw new Error("Zone aggregate surface has too many results");
		const seen = new Set<string>();
		const results = surface.results.map((entry): ZoneAggregateResultEntry => {
			if (!isRecord(entry) || !isDocument(BlockPath, entry.path))
				throw new Error("Zone aggregate result has an invalid Block path");
			const key = encodeBlockPath(entry.path);
			if (seen.has(key)) throw new Error("Zone aggregate surface has duplicate Block paths");
			seen.add(key);
			return { path: entry.path, outcome: parseResult(entry.outcome) };
		});
		return { results };
	};

	return {
		pageRevision: value.pageRevision,
		page: parseSurface(value.page, MaximumPageAggregateResults),
		...(value.dock === undefined
			? {}
			: { dock: parseSurface(value.dock, MaximumDockAggregateResults) }),
	};
}
