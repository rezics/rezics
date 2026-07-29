import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import { urlStateOptions } from "@/lib/search-params";
import { parseAsStringLiteral } from "nuqs/server";

export const AllProgressHistoryStatuses = "all" as const;
export const ProgressHistoryFilters = [AllProgressHistoryStatuses, "active", "completed"] as const;
export type ProgressHistoryFilter = (typeof ProgressHistoryFilters)[number];

export const progressHistoryFilterParser = parseAsStringLiteral(ProgressHistoryFilters)
	.withDefault(AllProgressHistoryStatuses)
	.withOptions({ ...urlStateOptions, history: "push" });

export function toProgressHistoryFilter(value: string | null | undefined): ProgressHistoryFilter {
	return (
		ProgressHistoryFilters.find((candidate) => candidate === value) ??
		AllProgressHistoryStatuses
	);
}

export function unitProgressHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/progress`;
}

export function progressEntryReviewHref(
	type: CatalogDetailUnitType,
	unitId: string,
	entryId: string,
): string {
	const search = new URLSearchParams({ progressEntryId: entryId });
	return `/units/${type}/${unitId}/reviews/new?${search}`;
}
