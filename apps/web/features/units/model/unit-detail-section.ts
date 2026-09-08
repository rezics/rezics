import { CatalogOwnerValues } from "@rezics/reference";
export const UnitDetailUnitTypes = [...CatalogOwnerValues, "video", "audio"] as const;
export type UnitDetailUnitType = (typeof UnitDetailUnitTypes)[number];
export const UnitDetailSections = {
	publishing: ["overview", "contents", "associations", "collections", "discussion"],
	music: ["overview", "associations", "collections", "discussion"],
	program: ["overview", "contents", "associations", "collections", "discussion"],
	software: ["overview", "facts", "associations", "collections", "discussion"],
	grouping: ["overview", "facts", "associations", "collections", "discussion"],
	entity: ["overview", "facts", "associations", "collections", "discussion"],
	reference: ["overview", "facts", "associations", "collections", "discussion"],
	distribution: ["overview", "facts", "associations", "collections", "discussion"],
	video: ["overview"],
	audio: ["overview"],
} as const;
export type UnitDetailSectionIdFor<Type extends UnitDetailUnitType> =
	(typeof UnitDetailSections)[Type][number];
export type UnitDetailSectionId = UnitDetailSectionIdFor<UnitDetailUnitType>;
export function isUnitDetailUnitType(value: string): value is UnitDetailUnitType {
	return UnitDetailUnitTypes.some((owner) => owner === value);
}
export function isUnitDetailSectionFor<Type extends UnitDetailUnitType>(
	type: Type,
	value: string,
): value is UnitDetailSectionIdFor<Type> {
	return UnitDetailSections[type].some((section) => section === value);
}
