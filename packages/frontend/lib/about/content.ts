import { ABOUT_PAGES, type AboutLocale, type AboutPageId } from "./locales";
import deCommon from "./content/locale/de/common.json";
import deHome from "./content/locale/de/home.json";
import deProduct from "./content/locale/de/product.json";
import enCommon from "./content/locale/en/common.json";
import enHome from "./content/locale/en/home.json";
import enProduct from "./content/locale/en/product.json";
import jaCommon from "./content/locale/ja/common.json";
import jaHome from "./content/locale/ja/home.json";
import jaProduct from "./content/locale/ja/product.json";
import koCommon from "./content/locale/ko/common.json";
import koHome from "./content/locale/ko/home.json";
import koProduct from "./content/locale/ko/product.json";
import zhHansCommon from "./content/locale/zh-hans/common.json";
import zhHansHome from "./content/locale/zh-hans/home.json";
import zhHansProduct from "./content/locale/zh-hans/product.json";
import zhHantCommon from "./content/locale/zh-hant/common.json";
import zhHantHome from "./content/locale/zh-hant/home.json";
import zhHantProduct from "./content/locale/zh-hant/product.json";
import type {
  AboutCommonCopy,
  AboutPageCopyByPage,
  HomePageCopy,
  MarkdownFragmentSlug,
  ProductEntry,
  ProductPageCopy,
  ProductStatus,
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
} as const satisfies Record<AboutLocale, unknown>;

const productCopyByLocale = {
  "zh-hant": zhHantProduct,
  "zh-hans": zhHansProduct,
  en: enProduct,
  ja: jaProduct,
  de: deProduct,
  ko: koProduct,
} as const satisfies Record<AboutLocale, unknown>;

const pageCopyByPage = {
  home: homeCopyByLocale,
  product: productCopyByLocale,
} as const satisfies Record<AboutPageId, Record<AboutLocale, unknown>>;

const ABOUT_PAGE_SET = new Set<string>(ABOUT_PAGES);
const PRODUCT_STATUS_SET = new Set<string>([
  "available",
  "preview",
  "planned",
] satisfies ProductStatus[]);

function asHomePageCopy(locale: AboutLocale, value: unknown): HomePageCopy {
  const copy = value as HomePageCopy & { primaryCtaPage?: string };
  if (!copy.primaryCtaPage || !ABOUT_PAGE_SET.has(copy.primaryCtaPage)) {
    throw new Error(
      `Invalid about home primary CTA page for locale: ${locale}`,
    );
  }
  return copy as HomePageCopy;
}

function asProductPageCopy(
  locale: AboutLocale,
  value: unknown,
): ProductPageCopy {
  const copy = value as ProductPageCopy & {
    products?: Array<ProductEntry & { status?: string }>;
  };
  const invalid = copy.products?.find(
    (product) => !product.status || !PRODUCT_STATUS_SET.has(product.status),
  );
  if (invalid) {
    throw new Error(
      `Invalid about product status for locale ${locale}: ${invalid.status}`,
    );
  }
  return copy as ProductPageCopy;
}

export function getCommonCopy(locale: AboutLocale): AboutCommonCopy {
  return commonCopyByLocale[locale];
}

export function getHomePageCopy(locale: AboutLocale): HomePageCopy {
  return asHomePageCopy(locale, homeCopyByLocale[locale]);
}

export function getProductPageCopy(locale: AboutLocale): ProductPageCopy {
  return asProductPageCopy(locale, productCopyByLocale[locale]);
}

export function getPageCopy<Page extends AboutPageId>(
  locale: AboutLocale,
  page: Page,
): AboutPageCopyByPage[Page] {
  if (page === "home") {
    return asHomePageCopy(
      locale,
      pageCopyByPage.home[locale],
    ) as AboutPageCopyByPage[Page];
  }
  return asProductPageCopy(
    locale,
    pageCopyByPage.product[locale],
  ) as AboutPageCopyByPage[Page];
}
