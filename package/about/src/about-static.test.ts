import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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
        expect(source).toContain("\n## ");
      }
    }
  });

  test("keeps home pages wired to the product narrative", async () => {
    for (const locale of ABOUT_LOCALES) {
      const source = await readMdxSource(locale, "home");
      expect(frontmatterBlock(source)).toContain('primaryCtaPage: "product"');
    }
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
