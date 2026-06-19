import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { REPO_ROOT } from "../core/paths";
import type { RuleScanner, Violation } from "../core/types";

const SPEC =
  "R16 — schema component JSON uses nodeId/slug/kind/placement conventions";

const LEGACY_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /schema:\s*"rezics\/zone-page"|schema:\s*"rezics\/realm-dock"/,
    message: "Use generic rezics/page and rezics/dock envelope names.",
  },
  {
    pattern: /\b(menuId|defaultTabId|searchPlaceholderKey|pinboardKey)\b/,
    message:
      "Use menuSlug, defaultTabNodeId, searchPlaceholderLabelUnitId, and placement.",
  },
  {
    pattern: /\bslot:\s*"|\bwidget:\s*\{/,
    message: "Dock widgets are direct `{ kind, nodeId, ... }` components.",
  },
];

function toRepoPath(absPath: string): string {
  return relative(REPO_ROOT, absPath).replace(/\\/g, "/");
}

function readLines(absPath: string): string[] {
  try {
    return readFileSync(absPath, "utf8").split("\n");
  } catch {
    return [];
  }
}

function isProductionSource(relPath: string): boolean {
  return (
    !relPath.endsWith(".test.ts") &&
    !relPath.endsWith(".test.tsx") &&
    !relPath.endsWith(".stories.tsx")
  );
}

function isSchemaSurfaceSource(relPath: string): boolean {
  return /^package\/(app|api|contract|server)\//.test(relPath);
}

function isComponentContractFile(relPath: string): boolean {
  return /^package\/contract\/src\/(page|dock|pinboard)\//.test(relPath);
}

function isSchemaNodeContractFile(relPath: string): boolean {
  return (
    /^package\/contract\/src\/(page|dock)\//.test(relPath) ||
    relPath === "package/contract/src/zone/menu.ts" ||
    relPath === "package/contract/src/zone/nav-v1.ts"
  );
}

function pushLineViolation(
  violations: Violation[],
  relPath: string,
  index: number,
  message: string,
) {
  violations.push({
    rule: "R16",
    path: `${relPath}:${index + 1}`,
    message,
    spec: SPEC,
  });
}

function scanLegacySerializedFields(violations: Violation[], absPath: string) {
  const relPath = toRepoPath(absPath);
  if (!isProductionSource(relPath) || !isSchemaSurfaceSource(relPath)) return;
  const lines = readLines(absPath);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    for (const { pattern, message } of LEGACY_PATTERNS) {
      if (pattern.test(line)) {
        pushLineViolation(violations, relPath, index, message);
      }
    }
  }
}

function scanContractComponentFields(violations: Violation[], absPath: string) {
  const relPath = toRepoPath(absPath);
  if (!isProductionSource(relPath)) return;
  const lines = readLines(absPath);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (isSchemaNodeContractFile(relPath) && /\bid\s*:\s*t\./.test(line)) {
      pushLineViolation(
        violations,
        relPath,
        index,
        "Schema component nodes must expose `nodeId`; reserve bare `id` for resource identity.",
      );
    }
    if (
      isComponentContractFile(relPath) &&
      /\btype\s*:\s*t\.Literal/.test(line)
    ) {
      pushLineViolation(
        violations,
        relPath,
        index,
        "Schema components discriminate with `kind`, not `type`.",
      );
    }
    if (isComponentContractFile(relPath) && /\bkey\s*:\s*t\./.test(line)) {
      pushLineViolation(
        violations,
        relPath,
        index,
        "Persisted component placement uses `placement`; do not introduce bare `key`.",
      );
    }
  }

  if (!isComponentContractFile(relPath)) return;

  const source = lines.join("\n");
  const values = new Set(
    [...source.matchAll(/export const ([A-Za-z0-9_]+Values)\s*=/g)].map(
      (match) => match[1],
    ),
  );
  for (const match of source.matchAll(
    /export const ([A-Za-z0-9_]+(?:Kind|Placement))Schema\s*=\s*([^\n]+)/g,
  )) {
    const base = match[1]!;
    const initializer = match[2]!;
    if (base.startsWith("schema")) continue;
    if (!values.has(`${base}Values`) && !initializer.includes("t.Literal(")) {
      const line = source.slice(0, match.index).split("\n").length;
      pushLineViolation(
        violations,
        relPath,
        line - 1,
        `Closed ${base}Schema must either expose ${base}Values or be a single literal schema.`,
      );
    }
  }

  for (const match of source.matchAll(
    /export const ([A-Za-z0-9_]+Values)\s*=\s*\[([\s\S]*?)\]\s*as const/g,
  )) {
    const literalCount = [...match[2]!.matchAll(/["'][^"']+["']/g)].length;
    if (literalCount === 1) {
      const line = source.slice(0, match.index).split("\n").length;
      pushLineViolation(
        violations,
        relPath,
        line - 1,
        `Single-value ${match[1]} should be a t.Literal and direct string type, not a values array.`,
      );
    }
  }
}

function scanPublicClasses(violations: Violation[], absPath: string) {
  const relPath = toRepoPath(absPath);
  if (!isProductionSource(relPath)) return;
  const lines = readLines(absPath);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (
      /\bclass(Name)?=/.test(line) &&
      /["'`\s](?:rz|re)-[A-Za-z0-9_-]+/.test(line)
    ) {
      pushLineViolation(
        violations,
        relPath,
        index,
        "Public styling hooks must not use ambiguous `rz-` or `re-` prefixes.",
      );
    }
    if (
      /\bclass(Name)?=/.test(line) &&
      line.includes("mx-auto") &&
      /max-w-/.test(line)
    ) {
      if (!/\bw-full\b|\bw-fit\b/.test(line)) {
        pushLineViolation(
          violations,
          relPath,
          index,
          "Centered constrained containers must include `w-full max-w-* mx-auto` or `w-fit mx-auto`.",
        );
      }
    }
  }
}

export const schemaComponentSystemRule: RuleScanner = {
  scan({ tsAndTsxFiles, tsxFiles, r9CandidateFiles }) {
    const violations: Violation[] = [];
    for (const absPath of tsAndTsxFiles) {
      scanLegacySerializedFields(violations, absPath);
      scanContractComponentFields(violations, absPath);
    }
    for (const absPath of tsxFiles) {
      scanPublicClasses(violations, absPath);
    }
    for (const absPath of r9CandidateFiles) {
      if (absPath.endsWith(".css")) scanPublicClasses(violations, absPath);
    }
    return violations;
  },
};
