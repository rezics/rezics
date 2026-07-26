import type {
	GetApiPostsByPostIdStatus200,
	GetApiReviewsByReviewIdStatus200,
} from "@rezics/openapi-tanstack-query";

export const PostManagementSectionIds = ["main", "attributions", "access", "history"] as const;

export type PostManagementSectionId = (typeof PostManagementSectionIds)[number];

type OrdinaryPostCapabilities = Pick<
	GetApiPostsByPostIdStatus200["capabilities"],
	"canEdit" | "canManageAccess" | "canManageAttributions"
>;

type ReviewCapabilities = Pick<
	GetApiReviewsByReviewIdStatus200["capabilities"],
	"canEdit" | "canManageAccess" | "canManageAttributions" | "canManageScores"
>;

export type PostManagementCapabilitySource =
	| Readonly<{ kind: "post"; capabilities: OrdinaryPostCapabilities }>
	| Readonly<{ kind: "review"; capabilities: ReviewCapabilities }>;

export function canOpenPostManagement(source: PostManagementCapabilitySource): boolean {
	if (source.kind === "review")
		return (
			source.capabilities.canEdit ||
			source.capabilities.canManageAttributions ||
			source.capabilities.canManageAccess ||
			source.capabilities.canManageScores
		);
	return (
		source.capabilities.canEdit ||
		source.capabilities.canManageAttributions ||
		source.capabilities.canManageAccess
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
				(source.kind === "review" && source.capabilities.canManageScores)
			);
		if (sectionId === "attributions") return source.capabilities.canManageAttributions;
		if (sectionId === "access") return source.capabilities.canManageAccess;
		return true;
	});
}
