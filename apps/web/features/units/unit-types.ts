const UnitTypes = ["book", "software", "media"] as const;

export type UnitType = (typeof UnitTypes)[number];

export function isUnitType(value: string): value is UnitType {
	return UnitTypes.some((type) => type === value);
}
