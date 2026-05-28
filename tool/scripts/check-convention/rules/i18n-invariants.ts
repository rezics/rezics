import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC = "openspec/specs/i18n-toolchain/spec.md";

const dynamicMessagePattern =
  /\bm\s*\[\s*(?!["'][A-Za-z0-9_.-]+["'])|const\s+\{[^}]+\}\s*=\s*m\b/;
const generatedMessageNamespaceImportPattern =
  /import\s+\*\s+as\s+\w+\s+from\s+["'](?:@rezics\/i18n\/messages|@rezics\/ui\/i18n\/messages|[^"']*paraglide\/messages(?:\.js)?)["']/;
const adapterGeneratedMessageImportPattern =
  /from\s+["'](?:@rezics\/i18n\/messages|@rezics\/ui\/i18n\/messages|[^"']*paraglide\/messages(?:\.js)?)["']/;
const i18nKeyCallPattern = /\bt\s*\([^)]*\.i18nKey\b/;
const contractI18nKeyPattern = /\bi18nKey\s*:/;
const frontendSourcePattern =
  /^package\/(?:app|admin|ui|editor|folio)\/src\/.*\.(?:ts|tsx)$/;
const legacyUseTranslationPattern =
  /from\s+["']@rezics\/i18n\/react["'][\s\S]*?\buseTranslation\b|\buseTranslation\s*\(/;
const legacyTranslatePattern =
  /from\s+["']@rezics\/i18n["'][\s\S]*?\btranslate\b|\btranslate\s*\(/;
const legacyFallbackPattern = /\bt\s*\(\s*["'][^"']+["']\s*,\s*["'][^"']+["']/;
const i18nextRuntimePattern =
  /from\s+["'](?:react-i18next|i18next)["']|require\(\s*["'](?:react-i18next|i18next)["']\s*\)/;
const uiCopyNullishFallbackPattern =
  /\bm\.[A-Za-z0-9_]+\([^)]*\)\s*(?:\?\?|\|\|)\s*["'][^"']*[A-Za-z][^"']*["']/;
const adminLocalLocalePattern =
  /from\s+["']@\/locale(?:\/[^"']*)?["']|from\s+["'][^"']*src\/locale(?:\/[^"']*)?["']/;

function shouldScan(relPath: string): boolean {
  if (/\.(?:test|spec)\.tsx?$/.test(relPath)) return false;
  return (
    frontendSourcePattern.test(relPath) ||
    relPath.startsWith("package/contract/src/")
  );
}

export function scanI18nSourceForTest(
  relPath: string,
  source: string,
): Violation[] {
  const violations: Violation[] = [];

  if (
    source.includes("paraglide/messages") &&
    dynamicMessagePattern.test(source)
  ) {
    violations.push({
      rule: "R11",
      path: relPath,
      message:
        "generated Paraglide messages must be referenced statically; route dynamic discriminators through explicit label maps",
      spec: SPEC,
    });
  }

  if (
    frontendSourcePattern.test(relPath) &&
    !relPath.endsWith(".stories.tsx") &&
    generatedMessageNamespaceImportPattern.test(source)
  ) {
    violations.push({
      rule: "R11",
      path: relPath,
      message:
        "production React source must import generated messages by name and bind them through useMessage(messageBag)",
      spec: SPEC,
    });
  }

  if (
    relPath === "package/i18n/src/react.ts" &&
    adapterGeneratedMessageImportPattern.test(source)
  ) {
    violations.push({
      rule: "R11",
      path: relPath,
      message:
        "@rezics/i18n/react must stay neutral and must not import generated message catalogs",
      spec: SPEC,
    });
  }

  if (i18nKeyCallPattern.test(source)) {
    violations.push({
      rule: "R12",
      path: relPath,
      message:
        "`t(*.i18nKey)` is forbidden; use @rezics/i18n label helpers instead",
      spec: SPEC,
    });
  }

  if (frontendSourcePattern.test(relPath)) {
    if (
      relPath.startsWith("package/admin/src/locale/") ||
      (relPath.startsWith("package/admin/src/") &&
        adminLocalLocalePattern.test(source))
    ) {
      violations.push({
        rule: "R12",
        path: relPath,
        message:
          "admin-local locale files/imports are forbidden; use generated @rezics/i18n messages or shared label helpers",
        spec: SPEC,
      });
    }

    if (i18nextRuntimePattern.test(source)) {
      violations.push({
        rule: "R12",
        path: relPath,
        message:
          "react-i18next/i18next runtime usage is forbidden for frontend UI copy; use generated Paraglide functions",
        spec: SPEC,
      });
    }

    if (legacyUseTranslationPattern.test(source)) {
      violations.push({
        rule: "R12",
        path: relPath,
        message:
          "`useTranslation().t(...)` is forbidden for frontend UI copy; import generated Paraglide functions or use useLocale for locale state",
        spec: SPEC,
      });
    }

    if (legacyTranslatePattern.test(source)) {
      violations.push({
        rule: "R12",
        path: relPath,
        message:
          "`translate(...)` is forbidden for frontend UI copy; import generated Paraglide functions or typed label helpers",
        spec: SPEC,
      });
    }

    if (legacyFallbackPattern.test(source)) {
      violations.push({
        rule: "R12",
        path: relPath,
        message:
          "fallback string translation calls are forbidden; add the message to the JSON catalog and call the generated function",
        spec: SPEC,
      });
    }

    if (uiCopyNullishFallbackPattern.test(source)) {
      violations.push({
        rule: "R12",
        path: relPath,
        message:
          "static UI copy fallbacks with ?? or || are forbidden; add catalog entries and call generated message functions",
        spec: SPEC,
      });
    }
  }

  if (
    relPath.startsWith("package/contract/src/") &&
    contractI18nKeyPattern.test(source)
  ) {
    violations.push({
      rule: "R12",
      path: relPath,
      message:
        "contract domain objects must not define i18nKey fields; message identity belongs in @rezics/i18n",
      spec: SPEC,
    });
  }

  return violations;
}

export const i18nInvariantsRule: RuleScanner = {
  scan({ tsAndTsxFiles }) {
    const violations: Violation[] = [];

    for (const filePath of tsAndTsxFiles) {
      const relPath = relative(REPO_ROOT, filePath);
      if (!shouldScan(relPath)) continue;

      violations.push(
        ...scanI18nSourceForTest(relPath, readFileSync(filePath, "utf8")),
      );
    }

    return violations;
  },
};
