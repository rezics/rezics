export const TagDetailSections = ["overview", "discussion", "content", "structure"] as const;

export type TagDetailSectionId = (typeof TagDetailSections)[number];

export function isTagDetailSection(value: string): value is TagDetailSectionId {
	return TagDetailSections.some((candidate) => candidate === value);
}
