import { createHash, randomBytes } from "node:crypto";

import {
	encodeBlockPath,
	type BlockPath,
	type DerivedSearchFeatureSource,
	type DirectSearchFeatureSource,
} from "@rezics/block";
import type { SearchInjection, SearchSort } from "@rezics/filter";
import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq } from "drizzle-orm";

import type { Authorization } from "../../authorization";
import { getUnitReadCondition } from "../../authorization/unit/query";
import { database } from "../../database";
import { collectionItem, unit, unitFollow } from "../../database/schema";
import { getReadableUnitPresentationsByIds, type UnitPresentation } from "../../units/attribution";
import { CollectionNotFound } from "../collections/errors";

export const DerivedSelectorCandidateLimit = 1_000;

export type DerivedSearchResourceContext =
	| { readonly kind: "page"; readonly pageId: string }
	| { readonly kind: "dock"; readonly zoneId: string; readonly slot: "main" };

export interface DerivedSearchResolution {
	readonly cacheability: "shared" | "private" | "uncacheable";
	readonly feature: DirectSearchFeatureSource;
	readonly hidden: boolean;
	readonly injections: readonly SearchInjection[];
	readonly selected?: UnitPresentation;
	readonly selectionSeed?: string;
	readonly sort?: SearchSort;
}

async function collectionTagCandidates(
	collectionId: string,
	authorization: Authorization,
): Promise<readonly string[]> {
	await authorization.unit.ensureCanRead(collectionId, () => new CollectionNotFound());
	const rows = await database
		.select({ id: unit.id })
		.from(collectionItem)
		.innerJoin(unit, eq(unit.id, collectionItem.unitId))
		.where(
			and(
				eq(collectionItem.collectionId, collectionId),
				eq(unit.kind, "tag"),
				getUnitReadCondition(authorization.profileId),
			),
		)
		.orderBy(asc(collectionItem.unitId))
		.limit(DerivedSelectorCandidateLimit);
	return rows.map(({ id }) => id);
}

async function followedTagCandidates(
	profileId: string,
	authorization: Authorization,
): Promise<readonly string[]> {
	const rows = await database
		.select({ id: unit.id })
		.from(unitFollow)
		.innerJoin(unit, eq(unit.id, unitFollow.unitId))
		.where(
			and(
				eq(unitFollow.followerProfileId, profileId),
				eq(unit.kind, "tag"),
				getUnitReadCondition(authorization.profileId),
			),
		)
		.orderBy(asc(unitFollow.unitId))
		.limit(DerivedSelectorCandidateLimit);
	return rows.map(({ id }) => id);
}

function resourceSeed(context: DerivedSearchResourceContext): string {
	return context.kind === "page"
		? `page:${context.pageId}`
		: `dock:${context.zoneId}:${context.slot}`;
}

export function deriveDerivedSelectionSeed(
	source: DerivedSearchFeatureSource,
	context: DerivedSearchResourceContext,
	path: BlockPath,
	override: string | undefined,
	now: Date,
): { readonly hashSeed: string; readonly continuationSeed: string } {
	const resourcePathSeed = resourceSeed(context) + ":" + encodeBlockPath(path);
	const continuationSeed =
		override ??
		(source.select.seed.kind === "request"
			? `request:${randomBytes(16).toString("hex")}`
			: `bucket:${Math.floor(now.getTime() / (source.select.seed.hours * 60 * 60 * 1_000))}`);
	return {
		hashSeed: resourcePathSeed + ":continuation:" + continuationSeed,
		continuationSeed,
	};
}

export function selectDerivedCandidate(
	candidates: readonly string[],
	seed: string,
): string | undefined {
	if (!candidates.length) return;
	const digest = createHash("sha256").update(seed).digest();
	const index = Number(digest.readBigUInt64BE(0) % BigInt(candidates.length));
	return candidates[index];
}

async function candidatesForSource(
	source: DerivedSearchFeatureSource,
	authorization: Authorization,
): Promise<readonly string[]> {
	if (source.select.from.kind === "collection")
		return collectionTagCandidates(source.select.from.collectionId, authorization);
	if (authorization.profileId) return followedTagCandidates(authorization.profileId, authorization);
	if (source.fallback.kind === "collection")
		return collectionTagCandidates(source.fallback.collectionId, authorization);
	return [];
}

/**
 * Resolve exactly one bounded selector hop into the existing trusted Tag
 * injection. Unit/Page/Dock identities stay in runtime context, outside JSON.
 */
export async function resolveDerivedSearchSource(input: {
	readonly authorization: Authorization;
	readonly localizationLanguages: readonly ContentLanguage[];
	readonly now?: Date;
	readonly path: BlockPath;
	readonly resource: DerivedSearchResourceContext;
	readonly selectionSeed?: string;
	readonly source: DerivedSearchFeatureSource;
}): Promise<DerivedSearchResolution> {
	const cacheability =
		input.source.select.seed.kind === "request"
			? "uncacheable"
			: input.source.select.from.kind === "viewer-follows" && input.authorization.profileId
				? "private"
				: "shared";
	let candidates = await candidatesForSource(input.source, input.authorization);
	if (
		candidates.length === 0 &&
		input.source.fallback.kind === "collection" &&
		(input.source.select.from.kind !== "collection" ||
			input.source.fallback.collectionId !== input.source.select.from.collectionId)
	)
		candidates = await collectionTagCandidates(
			input.source.fallback.collectionId,
			input.authorization,
		);
	const seed = deriveDerivedSelectionSeed(
		input.source,
		input.resource,
		input.path,
		input.selectionSeed,
		input.now ?? new Date(),
	);
	const selectedId = selectDerivedCandidate(candidates, seed.hashSeed);
	if (!selectedId)
		return {
			cacheability,
			feature: input.source.query.feature,
			hidden: true,
			injections: [],
			...(seed.continuationSeed ? { selectionSeed: seed.continuationSeed } : {}),
			sort: input.source.query.sort,
		};
	const selected = (
		await getReadableUnitPresentationsByIds({
			unitIds: [selectedId],
			localizationLanguages: input.localizationLanguages,
			profileId: input.authorization.profileId,
		})
	).get(selectedId);
	if (!selected)
		return {
			cacheability,
			feature: input.source.query.feature,
			hidden: true,
			injections: [],
			...(seed.continuationSeed ? { selectionSeed: seed.continuationSeed } : {}),
			sort: input.source.query.sort,
		};
	return {
		cacheability,
		feature: input.source.query.feature,
		hidden: false,
		injections: [
			{
				source: "tag",
				removable: false,
				value: {
					controlKey: "tag",
					filter: { field: "tag", operator: "equals", value: selectedId },
				},
			},
		],
		selected,
		...(seed.continuationSeed ? { selectionSeed: seed.continuationSeed } : {}),
		sort: input.source.query.sort,
	};
}
