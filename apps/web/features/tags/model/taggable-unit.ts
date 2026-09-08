import {
	GetApiResourcesByOwnerByUnitIdTagsOwner,
	type GetApiResourcesByOwnerByUnitIdTagsPath,
} from "@rezics/openapi-tanstack-query";

export type TaggableUnitType = GetApiResourcesByOwnerByUnitIdTagsPath["owner"];
export const TaggableUnitTypes = Object.values(GetApiResourcesByOwnerByUnitIdTagsOwner);
export function isTaggableUnitType(value: string): value is TaggableUnitType {
	return TaggableUnitTypes.some((owner) => owner === value);
}
