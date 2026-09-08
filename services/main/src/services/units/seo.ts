import { presentImageAsset } from "../api/image-assets/presentation";
import { CatalogOwnerValues, type UnitOwner } from "@rezics/reference";
import type { DatabaseTransaction } from "../database";
import { readUnitStateById } from "./query";
import { readUnitPresentationsInTransaction } from "./presentation-reader";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { isContentLanguage } from "@rezics/i18n";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

import { database } from "../database";
import { creditAttribution, unitLocalization, zonePage } from "../database/schema";
import { type ContentRating } from "../database/schema/contract-values";
import { UnitNotFound } from "./errors";
import { localizationLanguageOrder, resolvedUnitLocalizationTitle } from "./localization";
import {
	classifyPublicUnitSeoIndexing,
	isPublicUnitSeoOwner,
	isSeoContentRating,
	type PublicUnitSeoIndexing,
	type PublicUnitSeoOwner,
} from "./seo-contract";

export type PublicUnitSeoImageRole = "avatar" | "banner" | "cover";

export type PublicUnitSeoContext =
	| { readonly kind: "entity"; readonly shape: string }
	| {
			readonly kind: "zone_page";
			readonly zoneId: string;
			readonly zoneTitle: string | null;
	  }
	| { readonly kind: "post"; readonly attributionTitle: string | null };

type PublicUnitSeoPresentation = {
	readonly language: string | null;
	readonly title: string;
	readonly description: string | null;
	readonly image: { readonly id: string; readonly url: string } | null;
	readonly context: PublicUnitSeoContext | null;
};

export type PublicUnitSeoProjection = {
	readonly id: string;
	readonly owner: PublicUnitSeoOwner;
	readonly shape: string;
	readonly contentRating: ContentRating;
	readonly publishedAt: Date | null;
	readonly updatedAt: Date;
} & (
	| {
			readonly indexing: { readonly state: "noindex"; readonly reason: "adult" };
			readonly presentation: null;
	  }
	| {
			readonly indexing: { readonly state: "noindex"; readonly reason: "incomplete" };
			readonly presentation: null;
	  }
	| {
			readonly indexing: { readonly state: "index" };
			readonly presentation: PublicUnitSeoPresentation;
	  }
	| {
			readonly indexing: { readonly state: "noindex"; readonly reason: "unlisted" };
			readonly presentation: PublicUnitSeoPresentation;
	  }
);

type PublicUnitSeoBase = {
	readonly id: string;
	readonly owner: UnitOwner;
	readonly shape: string;
	readonly status: "draft" | "published" | "archived";
	readonly visibility: "public" | "unlisted" | "private";
	readonly contentRating: ContentRating;
	readonly moderationStatus: "approved" | "pending" | "removed";
	readonly publishedAt: Date | null;
	readonly updatedAt: Date;
	readonly deletedAt: Date | null;
};

export function canProjectPublicUnitSeo(base: PublicUnitSeoBase): base is PublicUnitSeoBase & {
	readonly owner: PublicUnitSeoOwner;
	readonly shape: string;
	readonly status: "published";
	readonly visibility: "public" | "unlisted";
	readonly moderationStatus: "approved";
	readonly deletedAt: null;
} {
	return (
		isPublicUnitSeoOwner(base.owner) &&
		base.status === "published" &&
		base.visibility !== "private" &&
		base.moderationStatus === "approved" &&
		base.deletedAt === null
	);
}

function normalizeSeoText(value: string | null): string | null {
	const normalized = value?.replaceAll(/\s+/g, " ").trim();
	return normalized || null;
}

function isNoindexReason<
	Reason extends Extract<PublicUnitSeoIndexing, { readonly state: "noindex" }>["reason"],
>(
	indexing: PublicUnitSeoIndexing,
	reason: Reason,
): indexing is { readonly state: "noindex"; readonly reason: Reason } {
	return indexing.state === "noindex" && indexing.reason === reason;
}

async function getPublicUnitSeoContext(
	tx: DatabaseTransaction,
	owner: PublicUnitSeoOwner,
	shape: string,
	unitId: string,
	localizationLanguages: readonly string[],
): Promise<PublicUnitSeoContext | null> {
	if (owner === "entity") return { kind: "entity", shape };

	if (owner === "post") {
		const [row] = await tx
			.select({
				zoneId: zonePage.zoneId,
				zoneTitle: resolvedUnitLocalizationTitle(
					zonePage.zoneId,
					localizationLanguages.filter(isContentLanguage),
				),
			})
			.from(zonePage)
			.where(eq(zonePage.id, unitId))
			.limit(1);
		if (row) {
			const state = await readUnitStateById(tx, row.zoneId);
			if (
				!state ||
				!canProjectPublicUnitSeo({ ...state, owner: state.reference.owner }) ||
				!isSeoContentRating(state.contentRating)
			)
				return null;
			return { kind: "zone_page", ...row };
		}
	}
	if (owner === "post") {
		const [row] = await tx
			.select({ id: creditAttribution.creditedEntityId })
			.from(creditAttribution)
			.where(eq(creditAttribution.sourceUnitId, unitId))
			.orderBy(asc(creditAttribution.position), asc(creditAttribution.id))
			.limit(1);
		if (!row) return { kind: "post", attributionTitle: null };
		const state = await readUnitStateById(tx, row.id);
		if (
			!state ||
			!canProjectPublicUnitSeo({ ...state, owner: state.reference.owner }) ||
			!isSeoContentRating(state.contentRating)
		)
			return { kind: "post", attributionTitle: null };
		const labels = await readUnitPresentationsInTransaction(tx, [row.id], localizationLanguages);
		return { kind: "post", attributionTitle: normalizeSeoText(labels.get(row.id)?.title ?? null) };
	}
	return null;
}

/**
 * Resolves the sanitized SEO projection for exactly one publicly visitable Unit.
 *
 * The lookup seeks the locator and one concrete owner. Language preferences are bounded to 32
 * BCP 47 tags; catalog names use selective active owner/language indexes. Optional context
 * lookups are single-row indexed reads. Consequently the request cost is independent of corpus
 * size at both the 500,000,000-row baseline and the 3,000,000,000-row estimate.
 */
export async function getPublicUnitSeoProjection(
	unitId: string,
	localizationLanguages: readonly string[] = [],
): Promise<PublicUnitSeoProjection> {
	if (localizationLanguages.length > 32)
		throw new RangeError("SEO language preferences exceed the request bound");
	const canonicalLanguages = [
		...new Set(localizationLanguages.map(canonicalizeContentLanguageTag)),
	];
	return database.transaction(
		async (tx) => {
			const state = await readUnitStateById(tx, unitId);
			const base = state ? { ...state, owner: state.reference.owner } : null;
			if (!base || !canProjectPublicUnitSeo(base)) throw new UnitNotFound();

			const identity = {
				id: base.id,
				owner: base.owner,
				shape: base.shape,
				contentRating: base.contentRating,
				publishedAt: base.publishedAt,
				updatedAt: base.updatedAt,
			} as const;
			if (!isSeoContentRating(base.contentRating)) {
				const indexing = classifyPublicUnitSeoIndexing({
					contentRating: base.contentRating,
					visibility: base.visibility,
					hasPresentation: false,
				});
				if (!isNoindexReason(indexing, "adult"))
					throw new Error("Adult SEO classification did not fail closed");
				return {
					...identity,
					indexing,
					presentation: null,
				};
			}

			const [localization] = await tx
				.select({
					language: unitLocalization.language,
					title: unitLocalization.title,
					description: sql<string | null>`nullif(
				left(
					regexp_replace(
						coalesce(
							nullif(btrim(${unitLocalization.summary}), ''),
							nullif(btrim(public.current_search_text_v1(${unitLocalization.description})), ''),
							nullif(btrim(public.current_search_text_v1(${unitLocalization.content})), '')
						),
						'\\s+',
						' ',
						'g'
					),
					600
				),
				''
			)`,
					imageAssetId: sql<string | null>`coalesce(
				${unitLocalization.coverAssetId},
				${unitLocalization.bannerAssetId},
				case when ${unitLocalization.avatarType} = 'image' then ${unitLocalization.avatarAssetId} end
			)`,
					imageRole: sql<PublicUnitSeoImageRole | null>`case
				when ${unitLocalization.coverAssetId} is not null then 'cover'
				when ${unitLocalization.bannerAssetId} is not null then 'banner'
				when ${unitLocalization.avatarType} = 'image' and ${unitLocalization.avatarAssetId} is not null then 'avatar'
				else null
			end`,
				})
				.from(unitLocalization)
				.where(
					and(
						eq(unitLocalization.unitId, base.id),
						or(
							isNull(unitLocalization.contentStatus),
							eq(unitLocalization.contentStatus, "published"),
						),
					),
				)
				.orderBy(
					localizationLanguageOrder(
						unitLocalization.language,
						canonicalLanguages.filter(isContentLanguage),
					),
					asc(unitLocalization.position),
					asc(unitLocalization.language),
				)
				.limit(1);

			const native = new Set<string>(CatalogOwnerValues).has(base.owner);
			const nativePresentation = native
				? (await readUnitPresentationsInTransaction(tx, [base.id], canonicalLanguages)).get(base.id)
				: null;
			const title = normalizeSeoText(
				native ? (nativePresentation?.title ?? null) : (localization?.title ?? null),
			);
			if (!title) {
				const indexing = classifyPublicUnitSeoIndexing({
					contentRating: base.contentRating,
					visibility: base.visibility,
					hasPresentation: false,
				});
				if (!isNoindexReason(indexing, "incomplete"))
					throw new Error("Incomplete SEO classification did not fail closed");
				return {
					...identity,
					indexing,
					presentation: null,
				};
			}

			const context = await getPublicUnitSeoContext(
				tx,
				base.owner,
				base.shape,
				base.id,
				canonicalLanguages,
			);
			const presentation = {
				language: native
					? (nativePresentation?.language ?? null)
					: (localization?.language ?? null),
				title: title.slice(0, 500),
				description:
					normalizeSeoText(localization?.description ?? nativePresentation?.summary ?? null)?.slice(
						0,
						600,
					) ?? null,
				image:
					localization?.imageAssetId && localization.imageRole
						? presentImageAsset(localization.imageAssetId, localization.imageRole)
						: null,
				context,
			} satisfies PublicUnitSeoPresentation;
			const indexing = classifyPublicUnitSeoIndexing({
				contentRating: base.contentRating,
				visibility: base.visibility,
				hasPresentation: true,
			});
			if (indexing.state === "index")
				return {
					...identity,
					indexing,
					presentation,
				};
			if (!isNoindexReason(indexing, "unlisted"))
				throw new Error("Presented SEO classification did not preserve visibility");
			return {
				...identity,
				indexing,
				presentation,
			};
		},
		{ isolationLevel: "repeatable read" },
	);
}
