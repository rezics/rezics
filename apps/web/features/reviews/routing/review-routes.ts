import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";

export function targetedReviewCreateHref(type: UnitDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/reviews/new`;
}
