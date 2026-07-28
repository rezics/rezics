export const ConsoleSectionIds = ["access", "moderation", "audit"] as const;
export type ConsoleSectionId = (typeof ConsoleSectionIds)[number];

export function isConsoleSectionId(value: string): value is ConsoleSectionId {
	return ConsoleSectionIds.some((section) => section === value);
}
