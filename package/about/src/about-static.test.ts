import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  REZICS_ARCHITECTURE_DOT,
  REZICS_ARCHITECTURE_NODE_LABELS,
} from "./components/rezicsArchitectureGraph";
import {
  ABOUT_LOCALES,
  ABOUT_PAGES,
  type AboutLocale,
  type AboutPageId,
  getCanonicalUrl,
  getPagePath,
} from "./i18n/locales";

const packageRoot = new URL("..", import.meta.url).pathname;

async function readMdxSource(
  locale: AboutLocale,
  page: AboutPageId,
): Promise<string> {
  const filename = page === "home" ? "index.mdx" : `${page}.mdx`;
  return readFile(join(packageRoot, "src/content", locale, filename), "utf8");
}

function frontmatterBlock(source: string): string {
  const match = source.match(/^---\n(?<frontmatter>[\s\S]*?)\n---\n/);
  if (!match?.groups?.frontmatter) {
    throw new Error("MDX source is missing frontmatter");
  }
  return match.groups.frontmatter;
}

function frontmatterValue(source: string, key: string): string | null {
  const match = frontmatterBlock(source).match(
    new RegExp(`^${key}:\\s*"(?<value>.+)"$`, "m"),
  );
  return match?.groups?.value ?? null;
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

  test("has localized MDX page sources for every supported route", async () => {
    for (const locale of ABOUT_LOCALES) {
      for (const page of ABOUT_PAGES) {
        const source = await readMdxSource(locale, page);
        expect(frontmatterValue(source, "title")?.length).toBeGreaterThan(12);
        expect(frontmatterValue(source, "description")?.length).toBeGreaterThan(
          40,
        );
        expect(frontmatterBlock(source)).toContain("hero:");
        expect(frontmatterBlock(source)).toContain("sections:");
        expect(frontmatterBlock(source)).toContain("storySections:");
        expect(source).toContain("\n## ");
      }
    }
  });

  test("keeps home pages wired to the product narrative", async () => {
    for (const locale of ABOUT_LOCALES) {
      const source = await readMdxSource(locale, "home");
      expect(frontmatterBlock(source)).toContain('primaryCtaPage: "product"');
      expect(source).toContain("inherited · create · spread");
      expect(source.toLowerCase()).toContain("wiki");
    }
  });

  test("keeps home and product narratives structurally distinct", async () => {
    for (const locale of ABOUT_LOCALES) {
      const homeSource = await readMdxSource(locale, "home");
      const productSource = await readMdxSource(locale, "product");

      expect(frontmatterBlock(homeSource)).not.toContain("products:");
      expect(frontmatterBlock(productSource)).toContain("products:");
      expect(productSource).toContain('name: "Rezics"');
    }
  });

  test("keeps home narrative focused on born-digital indexing pressure", async () => {
    const source = await readMdxSource("en", "home");

    expect(source).toContain("Web novels");
    expect(source).toContain("born-digital books");
    expect(source).toContain("As creation gets easier");
    expect(source).toContain("Tag-shelf discovery");
  });

  test("keeps product narrative focused on Rezics product surfaces", async () => {
    const source = await readMdxSource("en", "product");

    for (const expected of [
      "Catalog",
      "Reviews",
      "Shelves",
      "Tags",
      "Wiki",
      "Realms",
    ]) {
      expect(source).toContain(`title: "${expected}"`);
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
