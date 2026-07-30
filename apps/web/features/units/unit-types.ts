const CatalogUnitTypes = ["book", "software", "media", "series"] as const;
const UnitTypes = [...CatalogUnitTypes, "video", "audio"] as const;
const VariantUnitTypes = ["book", "software", "media"] as const;

export type CatalogUnitType = (typeof CatalogUnitTypes)[number];
export type UnitType = (typeof UnitTypes)[number];
export type VariantUnitType = (typeof VariantUnitTypes)[number];

export function isCatalogUnitType(value: string): value is CatalogUnitType {
	return CatalogUnitTypes.some((type) => type === value);
}

export function isUnitType(value: string): value is UnitType {
	return UnitTypes.some((type) => type === value);
}

export function isVariantUnitType(value: string): value is VariantUnitType {
	return VariantUnitTypes.some((type) => type === value);
}
