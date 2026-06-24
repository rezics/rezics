import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AboutLocale, AboutPageId } from "./locales";
import type { MarkdownFragmentSlug } from "./types";

export type MarkdownBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string };

export function getMarkdownFragment(
  locale: AboutLocale,
  page: AboutPageId,
  slug: MarkdownFragmentSlug,
): string {
  const fragmentPath = join(
    process.cwd(),
    "lib",
    "about",
    "content",
    "markdown",
    locale,
    page,
    `${slug}.md`,
  );
  return readFileSync(fragmentPath, "utf8");
}

export function parseMarkdownFragment(source: string): MarkdownBlock[] {
  return source
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("## ")) {
        return { kind: "heading", text: block.slice(3).trim() };
      }
      return { kind: "paragraph", text: block.replace(/\s*\n\s*/g, " ") };
    });
}
