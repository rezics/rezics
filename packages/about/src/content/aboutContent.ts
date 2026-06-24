import type { AboutLocale, AboutPageId } from "../i18n/locales";
import deCommon from "./locale/de/common.json";
import deHome from "./locale/de/home.json";
import deProduct from "./locale/de/product.json";
import enCommon from "./locale/en/common.json";
import enHome from "./locale/en/home.json";
import enProduct from "./locale/en/product.json";
import jaCommon from "./locale/ja/common.json";
import jaHome from "./locale/ja/home.json";
import jaProduct from "./locale/ja/product.json";
import koCommon from "./locale/ko/common.json";
import koHome from "./locale/ko/home.json";
import koProduct from "./locale/ko/product.json";
import zhHansCommon from "./locale/zh-hans/common.json";
import zhHansHome from "./locale/zh-hans/home.json";
import zhHansProduct from "./locale/zh-hans/product.json";
import zhHantCommon from "./locale/zh-hant/common.json";
import zhHantHome from "./locale/zh-hant/home.json";
import zhHantProduct from "./locale/zh-hant/product.json";
import type {
  AboutCommonCopy,
  AboutPageCopyByPage,
  HomePageCopy,
  MarkdownFragmentSlug,
  ProductPageCopy,
} from "./types";

export const ABOUT_MARKDOWN_FRAGMENTS = {
  home: ["hero", "closing"],
  product: ["hero", "closing"],
} as const satisfies Record<AboutPageId, readonly MarkdownFragmentSlug[]>;

const commonCopyByLocale = {
  "zh-hant": zhHantCommon,
  "zh-hans": zhHansCommon,
  en: enCommon,
  ja: jaCommon,
  de: deCommon,
  ko: koCommon,
} as const satisfies Record<AboutLocale, AboutCommonCopy>;

const homeCopyByLocale = {
  "zh-hant": zhHantHome,
  "zh-hans": zhHansHome,
  en: enHome,
  ja: jaHome,
  de: deHome,
  ko: koHome,
} as const satisfies Record<AboutLocale, HomePageCopy>;

const productCopyByLocale = {
  "zh-hant": zhHantProduct,
  "zh-hans": zhHansProduct,
  en: enProduct,
  ja: jaProduct,
  de: deProduct,
  ko: koProduct,
} as const satisfies Record<AboutLocale, ProductPageCopy>;

const pageCopyByPage = {
  home: homeCopyByLocale,
  product: productCopyByLocale,
} as const satisfies {
  [Page in AboutPageId]: Record<AboutLocale, AboutPageCopyByPage[Page]>;
};

export function getCommonCopy(locale: AboutLocale): AboutCommonCopy {
  return commonCopyByLocale[locale];
}

export function getHomePageCopy(locale: AboutLocale): HomePageCopy {
  return homeCopyByLocale[locale];
}

export function getProductPageCopy(locale: AboutLocale): ProductPageCopy {
  return productCopyByLocale[locale];
}

export function getPageCopy<Page extends AboutPageId>(
  locale: AboutLocale,
  page: Page,
): AboutPageCopyByPage[Page] {
  return pageCopyByPage[page][locale];
}
