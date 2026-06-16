import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  REZICS_ARCHITECTURE_DOT,
  REZICS_ARCHITECTURE_NODE_LABELS,
} from "./components/rezicsArchitectureGraph";
import {
  ABOUT_MARKDOWN_FRAGMENTS,
  getCommonCopy,
  getHomePageCopy,
  getProductPageCopy,
} from "./content/aboutContent";
import {
  ABOUT_LOCALES,
  ABOUT_PAGES,
  type AboutLocale,
  type AboutPageId,
  getCanonicalUrl,
  getPagePath,
} from "./i18n/locales";

const packageRoot = new URL("..", import.meta.url).pathname;

async function readMarkdownFragment(
  locale: AboutLocale,
  page: AboutPageId,
  slug: string,
): Promise<string> {
  return readFile(
    join(packageRoot, "src/content/markdown", locale, page, `${slug}.md`),
    "utf8",
  );
}

function markdownParagraphCount(source: string): number {
  return source
    .trim()
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim().length > 0).length;
}

describe("@rezics/about locale contract", () => {
  test("uses the canonical Rezics language codes", () => {
    expect(ABOUT_LOCALES).toEqual([
      "zh-hant",
      "zh-hans",
      "en",
      "ja",
      "de",
      "ko",
    ]);
  });

  test("has common, page, and markdown content for every locale", async () => {
    for (const locale of ABOUT_LOCALES) {
      const common = getCommonCopy(locale);

      expect(common.nav.home.length).toBeGreaterThan(1);
      expect(common.nav.product.length).toBeGreaterThan(1);
      expect(common.cta.enterApp.length).toBeGreaterThan(4);
      expect(common.notFound.body.length).toBeGreaterThan(20);

      for (const page of ABOUT_PAGES) {
        const copy =
          page === "home"
            ? getHomePageCopy(locale)
            : getProductPageCopy(locale);

        expect(copy.meta.title.length).toBeGreaterThan(12);
        expect(copy.meta.description.length).toBeGreaterThan(40);
        expect(copy.hero.eyebrow.length).toBeGreaterThan(1);
        expect(copy.hero.heading.length).toBeGreaterThan(4);
        expect(copy.sections.length).toBeGreaterThanOrEqual(1);
        expect(copy.storySections.length).toBeGreaterThanOrEqual(1);

        for (const slug of ABOUT_MARKDOWN_FRAGMENTS[page]) {
          const fragment = await readMarkdownFragment(locale, page, slug);
          expect(fragment.trim().length).toBeGreaterThan(20);
        }
      }
    }
  });

  test("preserves explicit hero paragraph and localized eyebrow decisions", async () => {
    const expectedEyebrows: Record<AboutLocale, string> = {
      "zh-hant": "與所愛的故事相遇",
      "zh-hans": "与所爱的故事相遇",
      en: "Encounter the stories you love.",
      ja: "愛する物語と出会う",
      de: "Begegne den Geschichten, die du liebst.",
      ko: "사랑하는 이야기를 만나다",
    };

    for (const locale of ABOUT_LOCALES) {
      expect(getHomePageCopy(locale).hero.eyebrow).toBe(
        expectedEyebrows[locale],
      );

      const heroMarkdown = await readMarkdownFragment(locale, "home", "hero");
      expect(markdownParagraphCount(heroMarkdown)).toBe(2);
    }
  });

  test("keeps home pages wired to the product directory", async () => {
    for (const locale of ABOUT_LOCALES) {
      const copy = getHomePageCopy(locale);
      const closing = await readMarkdownFragment(locale, "home", "closing");

      expect(copy.primaryCtaPage).toBe("product");
      expect(copy.hero.heading).toContain("inherited · create · spread");
      expect(`${JSON.stringify(copy)}\n${closing}`.toLowerCase()).toContain(
        "wiki",
      );
    }
  });

  test("keeps home and product narratives structurally distinct", () => {
    for (const locale of ABOUT_LOCALES) {
      const home = getHomePageCopy(locale);
      const product = getProductPageCopy(locale);

      expect("products" in home).toBe(false);
      expect(product.products.length).toBeGreaterThanOrEqual(6);
      expect(product.products[0]?.name).toBe("Rezics Catalog");
      expect(product.products.every((entry) => entry.category.length > 0)).toBe(
        true,
      );
      expect(
        product.products.every((entry) => entry.statusLabel.length > 0),
      ).toBe(true);
    }
  });

  test("keeps home narrative focused on born-digital indexing pressure", async () => {
    const source = `${JSON.stringify(getHomePageCopy("en"))}\n${await readMarkdownFragment(
      "en",
      "home",
      "closing",
    )}`;

    expect(source).toContain("Web novels");
    expect(source).toContain("born-digital books");
    expect(source).toContain("As creation gets easier");
    expect(source).toContain("Tag-shelf discovery");
  });

  test("keeps product page focused on the Rezics product directory", () => {
    const source = JSON.stringify(getProductPageCopy("en"));

    for (const expected of [
      "Rezics Catalog",
      "Rezics Web",
      "Rezics Realms",
      "Rezics Wiki",
      "Rezics Shelves",
      "Rezics Graph",
    ]) {
      expect(source).toContain(expected);
    }

    expect(source).toContain('"status":"available"');
    expect(source).toContain('"status":"preview"');
    expect(source).toContain('"status":"planned"');
  });

  test("keeps long prose in markdown fragments instead of page json", async () => {
    for (const locale of ABOUT_LOCALES) {
      for (const page of ABOUT_PAGES) {
        const closing = await readMarkdownFragment(locale, page, "closing");
        expect(closing).toContain("\n## ");
      }
    }
  });
});

describe("@rezics/about architecture graph", () => {
  test("contains the required product relationship nodes", () => {
    for (const label of REZICS_ARCHITECTURE_NODE_LABELS) {
      expect(REZICS_ARCHITECTURE_DOT).toContain(label);
    }
  });

  test("keeps realm and realm-tag relationships explicit", () => {
    expect(REZICS_ARCHITECTURE_DOT).toContain("Realm -> RealmTag");
    expect(REZICS_ARCHITECTURE_DOT).toContain("RealmTag -> Tag");
    expect(REZICS_ARCHITECTURE_DOT).toContain("RealmTag -> WorkUnit");
    expect(REZICS_ARCHITECTURE_DOT).toContain("does not imply");
  });
});

describe("@rezics/about static routing", () => {
  test("builds localized paths for every primary page", () => {
    for (const locale of ABOUT_LOCALES) {
      expect(getPagePath(locale, "home")).toBe(`/${locale}/`);
      expect(getPagePath(locale, "product")).toBe(`/${locale}/product/`);
    }
  });

  test("builds canonical URLs for every localized route", () => {
    for (const locale of ABOUT_LOCALES) {
      for (const page of ABOUT_PAGES) {
        expect(getCanonicalUrl(locale, page)).toBe(
          `https://about.rezics.com${getPagePath(locale, page)}`,
        );
      }
    }
  });
});
