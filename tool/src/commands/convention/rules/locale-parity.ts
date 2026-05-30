import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R14 — contract, Paraglide, and catalogs share one locale set with exact key parity";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function contractLanguages(): string[] {
  const source = readFileSync(
    join(REPO_ROOT, "package/contract/src/language-core.ts"),
    "utf8",
  );
  const match = source.match(
    /export const LANGUAGES = \{([\s\S]*?)\} as const/,
  );
  if (!match?.[1]) return [];
  return [...match[1].matchAll(/:\s*["']([^"']+)["']/g)].map((m) => m[1]!);
}

function diff(actual: string[], expected: string[]) {
  return {
    missing: expected.filter((v) => !actual.includes(v)),
    extra: actual.filter((v) => !expected.includes(v)),
  };
}

function listNamespaces(localeDir: string): string[] {
  if (!existsSync(localeDir)) return [];
  return readdirSync(localeDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .sort();
}

export const localeParityRule: RuleScanner = {
  scan() {
    const violations: Violation[] = [];
    const langs = contractLanguages();
    const baseLocale = "en";

    // 1. The shared product/admin tree lives at `package/i18n/locales/<lng>/<ns>.json`.
    const sharedRoot = join(REPO_ROOT, "package/i18n/locales");
    if (!existsSync(sharedRoot) || !statSync(sharedRoot).isDirectory()) {
      violations.push({
        rule: "R14",
        path: "package/i18n/locales",
        message: "Shared i18n locale tree is missing",
        spec: SPEC,
      });
    } else {
      const baseDir = join(sharedRoot, baseLocale);
      const baseNamespaces = listNamespaces(baseDir);
      for (const lng of langs) {
        const lngDir = join(sharedRoot, lng);
        if (!existsSync(lngDir)) {
          violations.push({
            rule: "R14",
            path: relative(REPO_ROOT, lngDir),
            message: "Supported locale folder is missing",
            spec: SPEC,
          });
          continue;
        }
        const lngNamespaces = listNamespaces(lngDir);
        const nsDiff = diff(lngNamespaces, baseNamespaces);
        if (nsDiff.missing.length || nsDiff.extra.length) {
          violations.push({
            rule: "R14",
            path: relative(REPO_ROOT, lngDir),
            message: `Namespace files must match package/i18n/locales/${baseLocale} (missing: ${nsDiff.missing.join(", ") || "none"}; extra: ${nsDiff.extra.join(", ") || "none"})`,
            spec: SPEC,
          });
        }
        for (const ns of baseNamespaces) {
          if (!lngNamespaces.includes(ns)) continue;
          const baseKeys = Object.keys(
            readJson(join(baseDir, `${ns}.json`)) as Record<string, unknown>,
          );
          const lngKeys = Object.keys(
            readJson(join(lngDir, `${ns}.json`)) as Record<string, unknown>,
          );
          const keyDiff = diff(lngKeys, baseKeys);
          if (keyDiff.missing.length || keyDiff.extra.length) {
            violations.push({
              rule: "R14",
              path: relative(REPO_ROOT, join(lngDir, `${ns}.json`)),
              message: `Keys must match the ${baseLocale} ${ns} namespace (missing: ${keyDiff.missing.slice(0, 8).join(", ") || "none"}${keyDiff.missing.length > 8 ? ", ..." : ""}; extra: ${keyDiff.extra.slice(0, 8).join(", ") || "none"}${keyDiff.extra.length > 8 ? ", ..." : ""})`,
              spec: SPEC,
            });
          }
        }
      }
    }

    // 2. UI per-locale ES modules at `package/ui/locales/<lng>.ts` must mirror
    //    the English UI bundle's key set.
    const uiRoot = join(REPO_ROOT, "package/ui/locales");
    if (!existsSync(uiRoot)) {
      violations.push({
        rule: "R14",
        path: "package/ui/locales",
        message: "UI locale modules are missing",
        spec: SPEC,
      });
    } else {
      for (const lng of langs) {
        const path = join(uiRoot, `${lng}.ts`);
        if (!existsSync(path)) {
          violations.push({
            rule: "R14",
            path: relative(REPO_ROOT, path),
            message: "UI locale module is missing",
            spec: SPEC,
          });
        }
      }
    }

    return violations;
  },
};
