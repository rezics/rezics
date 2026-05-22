import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function contractLanguages(): string[] {
  const source = readFileSync(
    join(REPO_ROOT, "package/contract/src/language.ts"),
    "utf8",
  );
  const match = source.match(
    /export const LANGUAGES = \{([\s\S]*?)\} as const/,
  );
  return match?.[1]
    ? [...match[1].matchAll(/:\s*["']([^"']+)["']/g)].map(
        (languageMatch) => languageMatch[1]!,
      )
    : [];
}

describe("frontend i18n catalog parity", () => {
  test.each([
    "i18n",
    "ui",
  ] as const)("%s locales match contract languages and message keys", (packageName) => {
    const languages = contractLanguages();
    const settings = readJson(
      join(REPO_ROOT, `package/${packageName}/project.inlang/settings.json`),
    ) as { locales: string[] };
    expect(settings.locales).toEqual(languages);

    const messagesDir = join(REPO_ROOT, `package/${packageName}/messages`);
    const baseKeys = Object.keys(readJson(join(messagesDir, "en.json")));

    for (const language of languages) {
      const path = join(messagesDir, `${language}.json`);
      expect(existsSync(path)).toBe(true);
      expect(Object.keys(readJson(path))).toEqual(baseKeys);
    }
  });
});
