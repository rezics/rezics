import { parseAsStringLiteral } from "nuqs/server";

import { urlStateOptions } from "@/lib/search-params";
import { RealmModerationStatuses } from "../model/moderation-contract";

export const AllRealmModerationStatuses = "all" as const;
export const CurrentRealmModerationStatuses = "current" as const;
export const RealmModerationFilters = [
	CurrentRealmModerationStatuses,
	AllRealmModerationStatuses,
	...RealmModerationStatuses,
] as const;
export type RealmModerationFilter = (typeof RealmModerationFilters)[number];
export const RealmPublicationFilters = ["active", "withdrawn", "all"] as const;
export type RealmPublicationFilter = (typeof RealmPublicationFilters)[number];
export const AllRealmReportStates = "all" as const;
export const ReportedRealmUnits = "reported" as const;
export const RealmReportFilters = [AllRealmReportStates, ReportedRealmUnits] as const;
export type RealmReportFilter = (typeof RealmReportFilters)[number];

export const realmModerationFilterParser = parseAsStringLiteral(RealmModerationFilters)
	.withDefault(CurrentRealmModerationStatuses)
	.withOptions({ ...urlStateOptions, history: "push" });

export const realmPublicationFilterParser = parseAsStringLiteral(RealmPublicationFilters)
	.withDefault("active")
	.withOptions({ ...urlStateOptions, history: "push" });

export const realmReportFilterParser = parseAsStringLiteral(RealmReportFilters)
	.withDefault(AllRealmReportStates)
	.withOptions({ ...urlStateOptions, history: "push" });

export function toRealmReportFilter(value: string): RealmReportFilter {
	return value === ReportedRealmUnits ? ReportedRealmUnits : AllRealmReportStates;
}

export function toRealmModerationFilter(value: string): RealmModerationFilter {
	return (
		RealmModerationFilters.find((filter) => filter === value) ?? CurrentRealmModerationStatuses
	);
}

export function toRealmPublicationFilter(value: string): RealmPublicationFilter {
	return RealmPublicationFilters.find((filter) => filter === value) ?? "active";
}
