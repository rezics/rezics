import type { ResourceVisibility } from "../../database/schema/contract-values";

export type ProfileActivitySurface = "linked" | "profile";

export interface ProfileActivityReadInput {
	readonly categoryVisibility: ResourceVisibility;
	readonly itemVisibility: ResourceVisibility;
	readonly ownerProfileId: string;
	readonly viewerProfileId?: string;
	readonly blocked: boolean;
	readonly surface: ProfileActivitySurface;
}

/**
 * Decides whether a Score or current Progress snapshot may be disclosed.
 *
 * The profile preference is a category-wide visibility ceiling. It never
 * rewrites an item's stored visibility. Owners can always inspect their own
 * records; everyone else must satisfy both the category and item controls.
 */
export function isProfileActivityReadable(input: ProfileActivityReadInput): boolean {
	if (input.viewerProfileId === input.ownerProfileId) return true;
	if (input.blocked) return false;
	if (input.surface === "profile")
		return input.categoryVisibility === "public" && input.itemVisibility === "public";
	return input.categoryVisibility !== "private" && input.itemVisibility !== "private";
}
