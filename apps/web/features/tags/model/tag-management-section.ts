export const TagManagementSections = ["content"] as const;

export type TagManagementSectionId = (typeof TagManagementSections)[number];

export function isTagManagementSection(value: string): value is TagManagementSectionId {
	return TagManagementSections.some((candidate) => candidate === value);
}
