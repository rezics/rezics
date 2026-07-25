import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";

export function targetedReviewCreateHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/reviews/new`;
}
