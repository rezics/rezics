import type { GetApiPostsByPostIdStatus200 } from "@rezics/openapi-tanstack-query";

export const PostManagementSectionIds = [
	"main",
	"attributions",
	"realms",
	"access",
	"history",
] as const;

export type PostManagementSectionId = (typeof PostManagementSectionIds)[number];

type PostContentCapabilities = Pick<
	Exclude<GetApiPostsByPostIdStatus200, { postKind: "review" }>["capabilities"],
	"canEdit" | "canManageAccess" | "canManageAttributions" | "canManageRealmPublications"
>;

type ReviewCapabilities = Pick<
	Extract<GetApiPostsByPostIdStatus200, { postKind: "review" }>["capabilities"],
	| "canEdit"
	| "canManageAccess"
	| "canManageAttributions"
	| "canManageRealmPublications"
	| "canManageScores"
>;

export type PostManagementCapabilitySource =
	| Readonly<{
			postKind: Exclude<GetApiPostsByPostIdStatus200["postKind"], "review">;
			capabilities: PostContentCapabilities;
	  }>
	| Readonly<{ postKind: "review"; capabilities: ReviewCapabilities }>;

export function canOpenPostManagement(source: PostManagementCapabilitySource): boolean {
	if (source.postKind === "review")
		return (
			source.capabilities.canEdit ||
			source.capabilities.canManageAttributions ||
			source.capabilities.canManageAccess ||
			source.capabilities.canManageRealmPublications ||
			source.capabilities.canManageScores
		);
	return (
		source.capabilities.canEdit ||
		source.capabilities.canManageAttributions ||
		source.capabilities.canManageAccess ||
		source.capabilities.canManageRealmPublications
	);
}

export function getPostManagementSectionIds(
	source: PostManagementCapabilitySource,
): readonly PostManagementSectionId[] {
	if (!canOpenPostManagement(source)) return [];
	return PostManagementSectionIds.filter((sectionId) => {
		if (sectionId === "main")
			return (
				source.capabilities.canEdit ||
				(source.postKind === "review" && source.capabilities.canManageScores)
			);
		if (sectionId === "attributions") return source.capabilities.canManageAttributions;
		if (sectionId === "realms") return source.capabilities.canManageRealmPublications;
		if (sectionId === "access") return source.capabilities.canManageAccess;
		return true;
	});
}
