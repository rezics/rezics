import { isContentLanguage, type ContentLanguage } from "@rezics/i18n";

/** A runtime-proven, non-empty, duplicate-free content-language sequence. */
export type ContentLanguageOrder = readonly [ContentLanguage, ...ContentLanguage[]];

export function parseContentLanguageOrder(
	values: readonly unknown[],
): ContentLanguageOrder | undefined {
	const languages: ContentLanguage[] = [];
	const seen = new Set<ContentLanguage>();
	for (const value of values) {
		if (typeof value !== "string" || !isContentLanguage(value) || seen.has(value)) return undefined;
		seen.add(value);
		languages.push(value);
	}
	const [first, ...remaining] = languages;
	return first ? [first, ...remaining] : undefined;
}

export function moveContentLanguage(
	order: ContentLanguageOrder,
	language: ContentLanguage,
	targetIndex: number,
): ContentLanguageOrder {
	const currentIndex = order.indexOf(language);
	if (currentIndex < 0 || !Number.isSafeInteger(targetIndex)) return order;
	const boundedTarget = Math.max(0, Math.min(order.length - 1, targetIndex));
	if (currentIndex === boundedTarget) return order;
	const next = [...order];
	next.splice(currentIndex, 1);
	next.splice(boundedTarget, 0, language);
	const parsed = parseContentLanguageOrder(next);
	if (!parsed) throw new Error("Moving a proven content-language order broke its invariant");
	return parsed;
}

export function contentLanguageOrdersEqual(
	left: readonly ContentLanguage[],
	right: readonly ContentLanguage[],
): boolean {
	return left.length === right.length && left.every((language, index) => language === right[index]);
}
