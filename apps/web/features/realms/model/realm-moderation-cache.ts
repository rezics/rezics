import type {
	GetApiRealmsByRealmIdUnitsStatus200,
	PatchApiRealmsByRealmIdUnitsByUnitIdStatus200,
} from "@rezics/openapi-tanstack-query";
import type { InfiniteData } from "@tanstack/react-query";

import type { RealmModerationFilter } from "../routing/realm-moderation-route";

export type RealmModerationPage = GetApiRealmsByRealmIdUnitsStatus200;
export type RealmModerationUnit = RealmModerationPage["items"][number];
export type RealmModerationTarget = PatchApiRealmsByRealmIdUnitsByUnitIdStatus200["target"];
export type RealmModerationPages = InfiniteData<RealmModerationPage>;

export function realmModerationUnits(
	data: RealmModerationPages | undefined,
): RealmModerationUnit[] {
	const units = new Map<string, RealmModerationUnit>();
	for (const page of data?.pages ?? []) {
		for (const unit of page.items) units.set(unit.unitId, unit);
	}
	return [...units.values()];
}

export function updateRealmModerationPages(
	data: RealmModerationPages | undefined,
	unitId: string,
	target: RealmModerationTarget,
	filter: RealmModerationFilter,
): RealmModerationPages | undefined {
	if (!data) return data;
	const removeFromFilteredQueue = filter !== "all" && target.status !== filter;
	return {
		...data,
		pages: data.pages.map((page) => ({
			...page,
			items: removeFromFilteredQueue
				? page.items.filter((unit) => unit.unitId !== unitId)
				: page.items.map((unit) =>
						unit.unitId === unitId ? { ...unit, ...target } : unit,
					),
		})),
	};
}
