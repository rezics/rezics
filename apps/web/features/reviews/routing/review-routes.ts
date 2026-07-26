import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";

export function targetedReviewCreateHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/reviews/new`;
}

export function reviewHref(reviewId: string, realmId?: string): string {
	const query = realmId ? `?realmId=${encodeURIComponent(realmId)}` : "";
	return `/reviews/${reviewId}${query}`;
}
