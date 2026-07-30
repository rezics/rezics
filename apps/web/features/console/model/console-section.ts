export const ConsoleSectionIds = [
	"users",
	"units",
	"ownership-claims",
	"moderation",
	"audit",
	"token-policies",
] as const;
export type ConsoleSectionId = (typeof ConsoleSectionIds)[number];

export function isConsoleSectionId(value: string): value is ConsoleSectionId {
	return ConsoleSectionIds.some((section) => section === value);
}
