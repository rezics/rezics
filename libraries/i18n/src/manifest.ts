import type { UiLocale } from "./locale-contract.ts";
import englishBrand from "./languages/en/brand.ts";
import traditionalChineseBrand from "./languages/zh-Hant/brand.ts";

export const LocalizedAppName = {
	"zh-Hant": traditionalChineseBrand.name,
	en: englishBrand.name,
} as const satisfies Readonly<Record<UiLocale, string>>;

export const LocalizedPwaDescription = {
	"zh-Hant": traditionalChineseBrand.pwaDescription,
	en: englishBrand.pwaDescription,
} as const satisfies Readonly<Record<UiLocale, string>>;
