export const SafeThemeQueryParameter = "rezics-safe-theme";

export function hasSafeThemeQuery(search: string): boolean {
	return new URLSearchParams(search).get(SafeThemeQueryParameter) === "1";
}

export function safeThemeHref(href: string): string {
	const url = new URL(href);
	url.searchParams.set(SafeThemeQueryParameter, "1");
	return url.href;
}
