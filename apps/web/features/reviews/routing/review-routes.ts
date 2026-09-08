import { unitDetailHref } from "@/features/units/routing/unit-detail-routes";
import type { UnitDetailUnitType } from "@/features/units/model/unit-detail-section";

export function targetedReviewCreateHref(type: UnitDetailUnitType, unitId: string): string {
	return `${unitDetailHref(type, unitId)}/reviews/new`;
}
