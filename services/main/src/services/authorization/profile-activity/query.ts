import { and, eq, exists, inArray, not, or, type SQLWrapper } from "drizzle-orm";

import { database } from "../../database";
import { profileBlock } from "../../database/schema";
import type { ProfileActivitySurface } from "./policy";

export interface ProfileActivityReadConditionInput {
	readonly categoryVisibility: SQLWrapper;
	readonly itemVisibility: SQLWrapper;
	readonly ownerProfileId: SQLWrapper;
	readonly viewerProfileId?: string;
	readonly surface: ProfileActivitySurface;
}

/**
 * Builds the shared Score/Progress disclosure condition.
 *
 * Callers must additionally enforce read access for every referenced Unit.
 */
export function getProfileActivityReadCondition(input: ProfileActivityReadConditionInput) {
	const categoryVisible =
		input.surface === "profile"
			? eq(input.categoryVisibility, "public")
			: inArray(input.categoryVisibility, ["public", "unlisted"]);
	const itemVisible =
		input.surface === "profile"
			? eq(input.itemVisibility, "public")
			: inArray(input.itemVisibility, ["public", "unlisted"]);
	const shared = and(
		categoryVisible,
		itemVisible,
		input.viewerProfileId
			? not(
					exists(
						database
							.select({ blockerProfileId: profileBlock.blockerProfileId })
							.from(profileBlock)
							.where(
								or(
									and(
										eq(profileBlock.blockerProfileId, input.viewerProfileId),
										eq(profileBlock.blockedProfileId, input.ownerProfileId),
									),
									and(
										eq(profileBlock.blockerProfileId, input.ownerProfileId),
										eq(profileBlock.blockedProfileId, input.viewerProfileId),
									),
								),
							),
					),
				)
			: undefined,
	);
	return input.viewerProfileId
		? or(eq(input.ownerProfileId, input.viewerProfileId), shared)
		: shared;
}
