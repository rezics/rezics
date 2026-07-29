export const ResourceVisibilityValues = ["public", "unlisted", "private"] as const;

export type ResourceVisibility = (typeof ResourceVisibilityValues)[number];

/**
 * The individual visibility assigned when a Score or Progress record is first created.
 *
 * @remarks
 * `public` is an intentional product default. Profile-wide visibility preferences are
 * separate disclosure ceilings and must not redefine this value; a stored record
 * becomes more restrictive only when the user explicitly changes its individual
 * visibility.
 */
export const DefaultResourceVisibility = "public" satisfies ResourceVisibility;

/**
 * Applies the profile-wide disclosure ceiling to an individual record setting.
 */
export function resolveEffectiveResourceVisibility(
	categoryVisibility: ResourceVisibility,
	itemVisibility: ResourceVisibility,
): ResourceVisibility {
	if (categoryVisibility === "private" || itemVisibility === "private") return "private";
	if (categoryVisibility === "unlisted" || itemVisibility === "unlisted") return "unlisted";
	return "public";
}

export function isResourceVisibility(value: string): value is ResourceVisibility {
	return ResourceVisibilityValues.some((visibility) => visibility === value);
}
