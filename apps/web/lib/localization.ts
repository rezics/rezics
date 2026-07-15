export function selectLocalization<T extends { language: string }>(
	items: readonly T[],
	locale: string,
	fallback?: string | null,
): T | undefined {
	return (
		items.find((item) => item.language === locale) ??
		(fallback ? items.find((item) => item.language === fallback) : undefined) ??
		items[0]
	);
}
