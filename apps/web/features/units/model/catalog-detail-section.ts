export const CatalogDetailUnitTypes = ["book", "media", "software"] as const;

export type CatalogDetailUnitType = (typeof CatalogDetailUnitTypes)[number];

export const CatalogDetailSections = {
	book: ["overview", "contents", "tags", "associations", "reviews", "discussion"],
	media: ["overview", "tags", "associations", "reviews", "discussion"],
	software: ["overview", "requirements", "tags", "associations", "reviews", "discussion"],
} as const satisfies Record<CatalogDetailUnitType, readonly string[]>;

export type CatalogDetailSectionId = {
	[Type in CatalogDetailUnitType]: (typeof CatalogDetailSections)[Type][number];
}[CatalogDetailUnitType];

export type CatalogDetailSectionIdFor<Type extends CatalogDetailUnitType> =
	(typeof CatalogDetailSections)[Type][number];

export function isCatalogDetailUnitType(value: string): value is CatalogDetailUnitType {
	return CatalogDetailUnitTypes.some((candidate) => candidate === value);
}

export function isCatalogDetailSectionFor<Type extends CatalogDetailUnitType>(
	type: Type,
	value: string,
): value is CatalogDetailSectionIdFor<Type> {
	return CatalogDetailSections[type].some((candidate) => candidate === value);
}
