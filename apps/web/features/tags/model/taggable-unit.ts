import type { GetApiUnitsByTypeByUnitIdTagsPath } from "@rezics/openapi-tanstack-query";

import { UnitDetailUnitTypes } from "@/features/units/model/unit-detail-section";

export type TaggableUnitType = GetApiUnitsByTypeByUnitIdTagsPath["type"];

export const TaggableUnitTypes = [
	...UnitDetailUnitTypes,
	"entity",
] as const satisfies readonly TaggableUnitType[];

export function isTaggableUnitType(value: string): value is TaggableUnitType {
	return TaggableUnitTypes.some((candidate) => candidate === value);
}
