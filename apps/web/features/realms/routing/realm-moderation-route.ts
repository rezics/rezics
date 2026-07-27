import { parseAsStringLiteral } from "nuqs/server";

import { urlStateOptions } from "@/lib/search-params";
import { RealmModerationStatuses, type RealmModerationStatus } from "../model/moderation-contract";

export const AllRealmModerationStatuses = "all" as const;
export const RealmModerationFilters = [
	AllRealmModerationStatuses,
	...RealmModerationStatuses,
] as const;
export type RealmModerationFilter = typeof AllRealmModerationStatuses | RealmModerationStatus;

export const realmModerationFilterParser = parseAsStringLiteral(RealmModerationFilters)
	.withDefault(AllRealmModerationStatuses)
	.withOptions({ ...urlStateOptions, history: "push" });
