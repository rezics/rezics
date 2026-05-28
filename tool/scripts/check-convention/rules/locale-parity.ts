import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC = "openspec/specs/i18n-toolchain/spec.md";

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

function inlangLocales(pkg: "i18n" | "ui"): string[] {
  const settings = readJson(
    join(REPO_ROOT, `package/${pkg}/project.inlang/settings.json`),
  ) as { locales?: unknown };
  return Array.isArray(settings.locales)
    ? settings.locales.filter((v): v is string => typeof v === "string")
    : [];
}

function diff(actual: string[], expected: string[]) {
  return {
    missing: expected.filter((v) => !actual.includes(v)),
    extra: actual.filter((v) => !expected.includes(v)),
  };
}

export const localeParityRule: RuleScanner = {
  scan() {
    const violations: Violation[] = [];
    const langs = contractLanguages();

    for (const pkg of ["i18n", "ui"] as const) {
      const locales = inlangLocales(pkg);
      const localeDiff = diff(locales, langs);
      if (localeDiff.missing.length || localeDiff.extra.length) {
        violations.push({
          rule: "R14",
          path: `package/${pkg}/project.inlang/settings.json`,
          message: `Paraglide locale list must match contract LANGUAGES (missing: ${localeDiff.missing.join(", ") || "none"}; extra: ${localeDiff.extra.join(", ") || "none"})`,
          spec: SPEC,
        });
      }

      const messagesDir = join(REPO_ROOT, `package/${pkg}/messages`);
      const basePath = join(messagesDir, "en.json");
      const baseMessages = existsSync(basePath)
        ? (readJson(basePath) as Record<string, unknown>)
        : null;

      if (!baseMessages) {
        violations.push({
          rule: "R14",
          path: `package/${pkg}/messages/en.json`,
          message: "Base locale message file is missing",
          spec: SPEC,
        });
        continue;
      }

      const baseKeys = Object.keys(baseMessages);
      for (const locale of langs) {
        const localePath = join(messagesDir, `${locale}.json`);
        const relLocalePath = relative(REPO_ROOT, localePath);
        if (!existsSync(localePath)) {
          violations.push({
            rule: "R14",
            path: relLocalePath,
            message: "Supported locale message file is missing",
            spec: SPEC,
          });
          continue;
        }

        const localeMessages = readJson(localePath) as Record<string, unknown>;
        const keyDiff = diff(Object.keys(localeMessages), baseKeys);
        if (keyDiff.missing.length || keyDiff.extra.length) {
          violations.push({
            rule: "R14",
            path: relLocalePath,
            message: `Message keys must match package/${pkg}/messages/en.json exactly (missing: ${keyDiff.missing.slice(0, 12).join(", ") || "none"}${keyDiff.missing.length > 12 ? ", ..." : ""}; extra: ${keyDiff.extra.slice(0, 12).join(", ") || "none"}${keyDiff.extra.length > 12 ? ", ..." : ""})`,
            spec: SPEC,
          });
        }
      }
    }

    return violations;
  },
};
