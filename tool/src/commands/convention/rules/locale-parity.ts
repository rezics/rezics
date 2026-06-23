import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { I18N_LOCALES_ROOT, REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R14 — all supported language files must be present in the i18n languages directory";

function listLanguageFiles(langDir: string): string[] {
  if (!existsSync(langDir)) return [];
  return readdirSync(langDir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => name.replace(/\.ts$/, ""))
    .sort();
}

export const localeParityRule: RuleScanner = {
  scan() {
    const violations: Violation[] = [];

    // Language files live at `packages/frontend/src/lib/i18n/languages/<locale>.ts`.
    // 语言文件位于 `packages/frontend/src/lib/i18n/languages/<locale>.ts`。
    const langRoot = I18N_LOCALES_ROOT;
    if (!existsSync(langRoot) || !statSync(langRoot).isDirectory()) {
      violations.push({
        rule: "R14",
        path: relative(REPO_ROOT, langRoot),
        message: "i18n languages directory is missing",
        spec: SPEC,
      });
      return violations;
    }

    const langs = listLanguageFiles(langRoot);
    if (langs.length === 0) {
      violations.push({
        rule: "R14",
        path: relative(REPO_ROOT, langRoot),
        message: "i18n languages directory contains no .ts language files",
        spec: SPEC,
      });
    }

    // Verify the base locale (en-US) exists.
    // 确认基准语言（en-US）存在。
    const baseLocale = "en-US";
    if (!langs.includes(baseLocale)) {
      violations.push({
        rule: "R14",
        path: relative(REPO_ROOT, join(langRoot, `${baseLocale}.ts`)),
        message: `Base locale file ${baseLocale}.ts is missing from the i18n languages directory`,
        spec: SPEC,
      });
    }

    return violations;
  },
};
