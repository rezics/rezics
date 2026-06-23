import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R11/R12 — no dynamic translation keys, fallback-string args, or contract i18nKey fields";

// `t(variableExpression)` — bare identifier, not a typed map lookup — is the
// dynamic-key anti-pattern. Bracketed indexing (`t(MAP[slug])`) is the
// blessed pattern and SHALL NOT be flagged.
// `t(variableExpression)`——裸标识符而非带类型的映射查找——属于动态键反模式。
// 方括号索引（`t(MAP[slug])`）是认可的模式，绝不应被标记。
const dynamicTranslateKeyPattern = /\bt\(\s*[A-Za-z_]\w*\s*[,)]/;
const dynamicTemplateKeyPattern = /\bt\(\s*`[^`]*\$\{[^`]*`/;
const contractI18nKeyPattern = /\bi18nKey\s*:/;
const frontendSourcePattern =
  /^packages\/frontend\/src\/.*\.(?:ts|tsx)$/;
const fallbackTranslatePattern =
  /\bt\s*\(\s*["'][^"']*:[^"']+["']\s*,\s*["'][^"']+["']\s*\)/;

function shouldScan(relPath: string): boolean {
  if (/\.(?:test|spec)\.tsx?$/.test(relPath)) return false;
  return (
    frontendSourcePattern.test(relPath) ||
    relPath.startsWith("packages/backend/src/")
  );
}

export function scanI18nSourceForTest(
  relPath: string,
  source: string,
): Violation[] {
  const violations: Violation[] = [];

  if (frontendSourcePattern.test(relPath)) {
    if (dynamicTranslateKeyPattern.test(source)) {
      violations.push({
        rule: "R11",
        path: relPath,
        message:
          // biome-ignore lint/suspicious/noTemplateCurlyInString: <i18n key patterns>
          "dynamic `t(variable)` is forbidden; dispatch through a `satisfies Record<Slug, '<ns>:${string}'>` map and call `t(MAP[slug])`",
        spec: SPEC,
      });
    }

    if (dynamicTemplateKeyPattern.test(source)) {
      violations.push({
        rule: "R11",
        path: relPath,
        message:
          "template-literal i18next keys are forbidden; use a typed slug-to-key map",
        spec: SPEC,
      });
    }

    if (fallbackTranslatePattern.test(source)) {
      violations.push({
        rule: "R12",
        path: relPath,
        message:
          "string-literal fallback as the second arg of `t(...)` is forbidden; add the missing key to the namespace JSON instead",
        spec: SPEC,
      });
    }
  }

  if (
    relPath.startsWith("packages/backend/src/") &&
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
