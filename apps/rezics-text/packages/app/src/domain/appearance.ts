export const rezicsTextThemePreferences = ["system", "light", "dark"] as const;
export type RezicsTextThemePreference = (typeof rezicsTextThemePreferences)[number];

export function isRezicsTextThemePreference(value: unknown): value is RezicsTextThemePreference {
	return (
		typeof value === "string" &&
		rezicsTextThemePreferences.some((preference) => preference === value)
	);
}
