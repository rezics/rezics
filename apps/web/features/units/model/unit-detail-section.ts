export const UnitDetailUnitTypes = ["book", "media", "software", "series"] as const;

export type UnitDetailUnitType = (typeof UnitDetailUnitTypes)[number];

export const UnitDetailSections = {
	book: ["overview", "contents", "associations", "collections", "discussion"],
	media: ["overview", "contents", "associations", "collections", "discussion"],
	software: ["overview", "requirements", "associations", "collections", "discussion"],
	series: ["overview", "releases", "associations", "collections", "discussion"],
} as const satisfies Record<UnitDetailUnitType, readonly string[]>;

export type UnitDetailSectionId = {
	[Type in UnitDetailUnitType]: (typeof UnitDetailSections)[Type][number];
}[UnitDetailUnitType];

export type UnitDetailSectionIdFor<Type extends UnitDetailUnitType> =
	(typeof UnitDetailSections)[Type][number];

export function isUnitDetailUnitType(value: string): value is UnitDetailUnitType {
	return UnitDetailUnitTypes.some((candidate) => candidate === value);
}

export function isUnitDetailSectionFor<Type extends UnitDetailUnitType>(
	type: Type,
	value: string,
): value is UnitDetailSectionIdFor<Type> {
	return UnitDetailSections[type].some((candidate) => candidate === value);
}
