import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

import { database } from "../database";
import { creditAttribution, entity, unit, unitLocalization, zonePage } from "../database/schema";
import {
	ContentLanguageValues,
	type ContentRating,
	type UnitKind,
} from "../database/schema/contract-values";
import { UnitNotFound } from "./errors";
import { localizationLanguageOrder, resolvedUnitLocalizationTitle } from "./localization";
import { presentImageAsset } from "./service";
import {
	classifyPublicUnitSeoIndexing,
	isPublicUnitSeoKind,
	isSeoContentRating,
	type PublicUnitSeoIndexing,
	type PublicUnitSeoKind,
} from "./seo-contract";

export type PublicUnitSeoImageRole = "avatar" | "banner" | "cover";

export type PublicUnitSeoContext =
	| { readonly kind: "entity"; readonly entityKind: string }
	| {
			readonly kind: "zone_page";
			readonly zoneId: string;
			readonly zoneTitle: string | null;
	  }
	| { readonly kind: "post"; readonly attributionTitle: string | null };

type PublicUnitSeoPresentation = {
	readonly language: ContentLanguage;
	readonly title: string;
	readonly description: string | null;
	readonly image: { readonly id: string; readonly url: string } | null;
	readonly context: PublicUnitSeoContext | null;
};

export type PublicUnitSeoProjection = {
	readonly id: string;
	readonly kind: PublicUnitSeoKind;
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
	readonly kind: UnitKind;
	readonly status: "draft" | "published" | "archived";
	readonly visibility: "public" | "unlisted" | "private";
	readonly contentRating: ContentRating;
	readonly moderationStatus: "approved" | "pending" | "removed";
	readonly publishedAt: Date | null;
	readonly updatedAt: Date;
	readonly deletedAt: Date | null;
};

export function canProjectPublicUnitSeo(base: PublicUnitSeoBase): base is PublicUnitSeoBase & {
	readonly kind: PublicUnitSeoKind;
	readonly status: "published";
	readonly visibility: "public" | "unlisted";
	readonly moderationStatus: "approved";
	readonly deletedAt: null;
} {
	return (
		isPublicUnitSeoKind(base.kind) &&
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
	kind: PublicUnitSeoKind,
	unitId: string,
	localizationLanguages: readonly ContentLanguage[],
): Promise<PublicUnitSeoContext | null> {
	if (kind === "entity") {
		const [row] = await database
			.select({ entityKind: entity.kind })
			.from(entity)
			.where(eq(entity.id, unitId))
			.limit(1);
		return row ? { kind: "entity", entityKind: row.entityKind } : null;
	}
	if (kind === "zone_page") {
		const [row] = await database
			.select({
				zoneId: zonePage.zoneId,
				zoneTitle: resolvedUnitLocalizationTitle(zonePage.zoneId, localizationLanguages),
			})
			.from(zonePage)
			.where(eq(zonePage.id, unitId))
			.limit(1);
		return row ? { kind: "zone_page", ...row } : null;
	}
	if (kind === "post") {
		const [row] = await database
			.select({
				attributionTitle: resolvedUnitLocalizationTitle(
					creditAttribution.creditedUnitId,
					localizationLanguages,
				),
			})
			.from(creditAttribution)
			.where(eq(creditAttribution.sourceUnitId, unitId))
			.orderBy(asc(creditAttribution.position), asc(creditAttribution.id))
			.limit(1);
		return {
			kind: "post",
			attributionTitle: normalizeSeoText(row?.attributionTitle ?? null),
		};
	}
	return null;
}

/**
 * Resolves the sanitized SEO projection for exactly one publicly visitable Unit.
 *
 * The Unit lookup uses the primary key. Localization fan-out is capped by the seven-value
 * ContentLanguage contract and uses the `(unit_id, position, language)` index. Optional context
 * lookups are single-row indexed reads. Consequently the request cost is independent of corpus
 * size at both the 500,000,000-row baseline and the 3,000,000,000-row estimate.
 */
export async function getPublicUnitSeoProjection(
	unitId: string,
	localizationLanguages: readonly ContentLanguage[] = [],
): Promise<PublicUnitSeoProjection> {
	const [base] = await database
		.select({
			id: unit.id,
			kind: unit.kind,
			status: unit.status,
			visibility: unit.visibility,
			contentRating: unit.contentRating,
			moderationStatus: unit.moderationStatus,
			publishedAt: unit.publishedAt,
			updatedAt: unit.updatedAt,
			deletedAt: unit.deletedAt,
		})
		.from(unit)
		.where(eq(unit.id, unitId))
		.limit(1);
	if (!base || !canProjectPublicUnitSeo(base)) throw new UnitNotFound();

	const identity = {
		id: base.id,
		kind: base.kind,
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

	const [localization] = await database
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
				or(isNull(unitLocalization.contentStatus), eq(unitLocalization.contentStatus, "published")),
			),
		)
		.orderBy(
			localizationLanguageOrder(unitLocalization.language, localizationLanguages),
			asc(unitLocalization.position),
			asc(unitLocalization.language),
		)
		.limit(ContentLanguageValues.length);

	const title = normalizeSeoText(localization?.title ?? null);
	if (!localization || !title) {
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

	const context = await getPublicUnitSeoContext(base.kind, base.id, localizationLanguages);
	const presentation = {
		language: localization.language,
		title,
		description: normalizeSeoText(localization.description),
		image:
			localization.imageAssetId && localization.imageRole
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
}
