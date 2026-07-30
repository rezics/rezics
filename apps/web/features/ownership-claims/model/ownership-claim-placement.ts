export const OwnershipClaimableUnitTypes = ["entity", "book", "media", "software"] as const;

export type OwnershipClaimPlacement = "external" | "overflow" | "none";

export function ownershipClaimPlacement(input: {
	readonly unitType: string;
	readonly ownershipMode: string;
}): OwnershipClaimPlacement {
	if (input.ownershipMode !== "community_owned") return "none";
	if (input.unitType === "entity") return "external";
	return input.unitType === "book" || input.unitType === "media" || input.unitType === "software"
		? "overflow"
		: "none";
}
