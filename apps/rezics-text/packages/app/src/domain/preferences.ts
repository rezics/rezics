export const markdownPreferenceSections = ["general", "files"] as const;
export type MarkdownPreferenceSection = (typeof markdownPreferenceSections)[number];

export function isMarkdownPreferenceSection(value: unknown): value is MarkdownPreferenceSection {
	return (
		typeof value === "string" && markdownPreferenceSections.some((section) => section === value)
	);
}
