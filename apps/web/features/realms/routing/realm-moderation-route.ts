import { parseAsStringLiteral } from "nuqs/server";

import { urlStateOptions } from "@/lib/search-params";
import { RealmModerationStatuses, type RealmModerationStatus } from "../model/moderation-contract";

export const AllRealmModerationStatuses = "all" as const;
export const RealmModerationFilters = [
	AllRealmModerationStatuses,
	...RealmModerationStatuses,
] as const;
export type RealmModerationFilter = typeof AllRealmModerationStatuses | RealmModerationStatus;
export const AllRealmReportStates = "all" as const;
export const ReportedRealmUnits = "reported" as const;
export const RealmReportFilters = [AllRealmReportStates, ReportedRealmUnits] as const;
export type RealmReportFilter = (typeof RealmReportFilters)[number];

export const realmModerationFilterParser = parseAsStringLiteral(RealmModerationFilters)
	.withDefault(AllRealmModerationStatuses)
	.withOptions({ ...urlStateOptions, history: "push" });

export const realmReportFilterParser = parseAsStringLiteral(RealmReportFilters)
	.withDefault(AllRealmReportStates)
	.withOptions({ ...urlStateOptions, history: "push" });

export function toRealmReportFilter(value: string): RealmReportFilter {
	return value === ReportedRealmUnits ? ReportedRealmUnits : AllRealmReportStates;
}
