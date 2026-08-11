import { urlStateOptions } from "@/lib/search-params";
import { parseAsStringLiteral } from "nuqs/server";
import type { ProgressTrackableUnitType } from "../model/progress-record";

export const AllProgressHistoryStatuses = "all" as const;
export const ProgressHistoryFilters = [AllProgressHistoryStatuses, "active", "completed"] as const;
export type ProgressHistoryFilter = (typeof ProgressHistoryFilters)[number];

export const progressHistoryFilterParser = parseAsStringLiteral(ProgressHistoryFilters)
	.withDefault(AllProgressHistoryStatuses)
	.withOptions({ ...urlStateOptions, history: "push" });

export function toProgressHistoryFilter(value: string | null | undefined): ProgressHistoryFilter {
	return (
		ProgressHistoryFilters.find((candidate) => candidate === value) ?? AllProgressHistoryStatuses
	);
}

export function unitProgressHref(type: ProgressTrackableUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/progress`;
}

export function progressEntryReviewHref(
	type: ProgressTrackableUnitType,
	unitId: string,
	entryId: string,
): string {
	const search = new URLSearchParams({ progressEntryId: entryId });
	return `/units/${type}/${unitId}/reviews/new?${search}`;
}
