export const ResourceVisibilityValues = ["public", "unlisted", "private"] as const;

export type ResourceVisibility = (typeof ResourceVisibilityValues)[number];

export const DefaultResourceVisibility = "public" satisfies ResourceVisibility;

export function isResourceVisibility(value: string): value is ResourceVisibility {
	return ResourceVisibilityValues.some((visibility) => visibility === value);
}
