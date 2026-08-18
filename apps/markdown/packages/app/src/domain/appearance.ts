export const markdownThemePreferences = ["system", "light", "dark"] as const;
export type MarkdownThemePreference = (typeof markdownThemePreferences)[number];

export function isMarkdownThemePreference(value: unknown): value is MarkdownThemePreference {
	return (
		typeof value === "string" && markdownThemePreferences.some((preference) => preference === value)
	);
}
