import type { UiLocale } from "./locale-contract.ts";
import germanBrand from "./languages/de/brand.ts";
import englishBrand from "./languages/en/brand.ts";
import spanishBrand from "./languages/es/brand.ts";
import frenchBrand from "./languages/fr/brand.ts";
import japaneseBrand from "./languages/ja/brand.ts";
import koreanBrand from "./languages/ko/brand.ts";
import simplifiedChineseBrand from "./languages/zh-Hans/brand.ts";
import traditionalChineseBrand from "./languages/zh-Hant/brand.ts";

export const LocalizedAppName = {
	de: germanBrand.name,
	en: englishBrand.name,
	es: spanishBrand.name,
	fr: frenchBrand.name,
	ja: japaneseBrand.name,
	ko: koreanBrand.name,
	"zh-Hans": simplifiedChineseBrand.name,
	"zh-Hant": traditionalChineseBrand.name,
} as const satisfies Readonly<Record<UiLocale, string>>;

export const LocalizedPwaDescription = {
	de: germanBrand.pwaDescription,
	en: englishBrand.pwaDescription,
	es: spanishBrand.pwaDescription,
	fr: frenchBrand.pwaDescription,
	ja: japaneseBrand.pwaDescription,
	ko: koreanBrand.pwaDescription,
	"zh-Hans": simplifiedChineseBrand.pwaDescription,
	"zh-Hant": traditionalChineseBrand.pwaDescription,
} as const satisfies Readonly<Record<UiLocale, string>>;
