export const OwnershipClaimableUnitTypes = ["entity", "book", "media", "software"] as const;

export type OwnershipClaimPlacement = "external" | "overflow" | "none";

export function ownershipClaimPlacement(input: {
	readonly unitType: string;
	readonly catalogMode: string;
}): OwnershipClaimPlacement {
	if (input.catalogMode !== "public_entry") return "none";
	if (input.unitType === "entity") return "external";
	return input.unitType === "book" || input.unitType === "media" || input.unitType === "software"
		? "overflow"
		: "none";
}
