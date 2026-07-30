const WorkUnitTypes = ["book", "software", "media", "series"] as const;
const UnitTypes = [...WorkUnitTypes, "video", "audio"] as const;
const VariantUnitTypes = ["book", "software", "media"] as const;

export type WorkUnitType = (typeof WorkUnitTypes)[number];
export type UnitType = (typeof UnitTypes)[number];
export type VariantUnitType = (typeof VariantUnitTypes)[number];

export function isWorkUnitType(value: string): value is WorkUnitType {
	return WorkUnitTypes.some((type) => type === value);
}

export function isUnitType(value: string): value is UnitType {
	return UnitTypes.some((type) => type === value);
}

export function isVariantUnitType(value: string): value is VariantUnitType {
	return VariantUnitTypes.some((type) => type === value);
}
