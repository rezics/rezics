export const UnitTypes = ["video", "audio"] as const;
export type UnitType = (typeof UnitTypes)[number];
/** Platform timed-media routes never stand in for native catalog identities. */
export function isUnitType(value: string): value is UnitType {
	return UnitTypes.some((type) => type === value);
}
