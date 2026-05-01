#!/usr/bin/env bun
/**
 * Convention check for API routes and folder names.
 *
 * Rules enforced (see openspec/specs/ for normative source):
 * - R1  api-route-convention     — Elysia route prefixes must be singular
 * - R2  api-route-convention     — list/collection endpoints use /list suffix
 * - R3  folder-naming-convention — domain/feature folders are singular
 * - R4  folder-naming-convention — container folders are plural from allowlist
 * - R5  outbound-link-protection — no raw <a href> outside SafeLink
 * - R6  tanstack-query-keys       — no inline `queryKey: [` outside api key/query/mutation files
 * - R7  seed-power-law-isolation  — only strategy.ts/utils.ts may import powerLaw in factory/
 *
 * Usage:
 *   bun run check:convention               # full scan
 *   bun run check:convention -- --staged   # only staged files
 *   bun run check:convention -- --snapshot # update expected-violations.json
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative } from "node:path";

const REPO_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const SCRIPTS_DIR = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const SNAPSHOT_PATH = join(SCRIPTS_DIR, "expected-violations.json");

// ─── Allowlists ──────────────────────────────────────────────────────────────

const PLURAL_CONTAINER_ALLOWLIST = new Set([
  "hooks",
  "utils",
  "components",
  "pages",
  "sections",
  "states",
  "models",
  "types",
  "routes",
  "handlers",
  "providers",
  "plugins",
  "styles",
  "helpers",
  "constants",
  "fixtures",
  "mocks",
  "layouts",
  "assets",
  "tokens",
  "docs",
  "templates",
  "parts",
  "forms",
  "kinds",
  "presets",
]);

// Singular domain folder names that are permitted even when their plural form
// is on PLURAL_CONTAINER_ALLOWLIST, because the two carry distinct semantics.
// Example: `token/` is the JWT/auth-token domain; `tokens/` is the design-token
// container. Both must coexist.
const SINGULAR_DOMAIN_EXCEPTIONS = new Set(["token"]);

const ROUTE_PREFIX_ALLOWLIST = new Set([
  "stats",
  "meili",
  "well-known",
  "jwt-services",
  "internal",
  "dispatch",
  "echokv",
  "upload",
  "collect",
  "token",
  "session",
  "dm",
  "score",
  "attribution",
  "link",
  "reaction",
  "zone",
  "realm",
  "shelf",
  "tag",
  "post",
  "book",
  "chapter",
  "feedback",
  "unit",
  "user",
  "brief",
  "list",
  "batch",
  "search",
  "me",
  "admin",
]);

const EXEMPT_DIR_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".output",
  ".next",
  ".vite",
  ".turbo",
  "coverage",
  "prisma/generated",
  "openspec",
];

const EXEMPT_PACKAGES = new Set(["auth"]);

// ─── Types ───────────────────────────────────────────────────────────────────

type Rule = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7";

interface Violation {
  rule: Rule;
  path: string;
  message: string;
  spec: string;
}

const SPEC_LINK: Record<Rule, string> = {
  R1: "openspec/specs/api-route-convention/spec.md",
  R2: "openspec/specs/api-route-convention/spec.md",
  R3: "openspec/specs/folder-naming-convention/spec.md",
  R4: "openspec/specs/folder-naming-convention/spec.md",
  R5: "openspec/specs/outbound-link-protection/spec.md",
  R6: "openspec/specs/tanstack-query-keys/spec.md",
  R7: "openspec/changes/seed-unified-plan-modes/specs/seed-power-law-distribution/spec.md",
};

// ─── Path utilities ─────────────────────────────────────────────────────────

function isExemptPath(absPath: string): boolean {
  const relPath = relative(REPO_ROOT, absPath);
  if (relPath.startsWith("..")) return true;
  return EXEMPT_DIR_PATTERNS.some(
    (pattern) =>
      relPath === pattern ||
      relPath.startsWith(`${pattern}/`) ||
      relPath.includes(`/${pattern}/`) ||
      relPath.endsWith(`/${pattern}`),
  );
}

function isExemptPackage(absPath: string): boolean {
  const relPath = relative(REPO_ROOT, absPath);
  const packageMatch = relPath.match(/^package\/([^/]+)/);
  if (!packageMatch?.[1]) return false;
  return EXEMPT_PACKAGES.has(packageMatch[1]);
}

// ─── Filesystem walking ─────────────────────────────────────────────────────

function* walkDirectories(root: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const entryName of entries) {
    const entryPath = join(root, entryName);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }
    if (isExemptPath(entryPath)) continue;
    yield entryPath;
    yield* walkDirectories(entryPath);
  }
}

function* walkFilesByExtension(
  root: string,
  extensionPattern: RegExp,
): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const entryName of entries) {
    const entryPath = join(root, entryName);
    let entryStat: ReturnType<typeof statSync>;
    try {
      entryStat = statSync(entryPath);
    } catch {
      continue;
    }
    if (entryStat.isDirectory()) {
      if (isExemptPath(entryPath)) continue;
      yield* walkFilesByExtension(entryPath, extensionPattern);
    } else if (extensionPattern.test(entryName)) {
      yield entryPath;
    }
  }
}

// ─── R1 + R2: route scanning ────────────────────────────────────────────────

const ELYSIA_PREFIX_PATTERN =
  /new\s+Elysia\s*\(\s*\{[^}]*prefix\s*:\s*["']([^"']+)["']/g;
const ROOT_HANDLER_PATTERN = /\.(get|post)\s*\(\s*["']\/["']\s*,/g;

const ELYSIA_VERB_PATTERN =
  /\.(get|post|put|patch|delete|options|use|onError|derive|decorate|state|resolve|guard|group)\s*\(/g;

function isPluralResource(segment: string): boolean {
  if (ROUTE_PREFIX_ALLOWLIST.has(segment)) return false;
  if (segment.endsWith("ies")) return true;
  if (segment.endsWith("ses")) return true;
  if (segment.endsWith("es") && segment.length > 3) return true;
  if (segment.endsWith("s") && !segment.endsWith("ss") && segment.length > 2)
    return true;
  return false;
}

function isCollectionHandler(handlerSource: string): boolean {
  return (
    /items\s*:/.test(handlerSource) ||
    /ListResponse/.test(handlerSource) ||
    /Array<|: [A-Z]\w*\[\]/.test(handlerSource)
  );
}

function scanRoutes(apiFiles: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const filePath of apiFiles) {
    if (!/\.api\.ts$/.test(filePath)) continue;
    let fileContent: string;
    try {
      fileContent = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    const relFilePath = relative(REPO_ROOT, filePath);

    for (const prefixMatch of fileContent.matchAll(ELYSIA_PREFIX_PATTERN)) {
      const prefix = prefixMatch[1]!;
      const segments = prefix.split("/").filter(Boolean);
      for (const segment of segments) {
        if (isPluralResource(segment)) {
          violations.push({
            rule: "R1",
            path: `${relFilePath}  prefix="${prefix}"`,
            message: `Elysia prefix contains plural segment "${segment}" — use singular form`,
            spec: SPEC_LINK.R1,
          });
          break;
        }
      }
    }

    for (const handlerMatch of fileContent.matchAll(ROOT_HANDLER_PATTERN)) {
      const matchIndex = handlerMatch.index;
      const precedingContext = fileContent.slice(
        Math.max(0, matchIndex - 120),
        matchIndex,
      );
      if (precedingContext.includes("@convention:root-list-ok")) continue;

      const contentAfterMatch = fileContent.slice(matchIndex);
      ELYSIA_VERB_PATTERN.lastIndex = 1;
      const nextVerbMatch = ELYSIA_VERB_PATTERN.exec(contentAfterMatch);
      const handlerEndIndex = Math.min(
        contentAfterMatch.length,
        nextVerbMatch ? nextVerbMatch.index : 2000,
      );
      const handlerSource = contentAfterMatch.slice(0, handlerEndIndex);

      if (!isCollectionHandler(handlerSource)) continue;

      const httpMethod = handlerMatch[1]!.toUpperCase();
      violations.push({
        rule: "R2",
        path: relFilePath,
        message: `${httpMethod} "/" likely returns a collection — move to "/list" or annotate with // @convention:root-list-ok`,
        spec: SPEC_LINK.R2,
      });
    }
  }

  return violations;
}

// ─── R3 + R4: folder scanning ───────────────────────────────────────────────

function isLikelyPlural(name: string): boolean {
  if (name.endsWith("ies")) return true;
  if (name.endsWith("ses")) return true;
  if (name.endsWith("es") && name.length > 3) return true;
  if (name.endsWith("s") && !name.endsWith("ss") && name.length > 2)
    return true;
  return false;
}

function findAllowlistedPluralForm(singularName: string): string | null {
  for (const pluralEntry of PLURAL_CONTAINER_ALLOWLIST) {
    if (pluralEntry === `${singularName}s`) return pluralEntry;
    if (
      pluralEntry === `${singularName}es` &&
      /(s|x|z|ch|sh)$/.test(singularName)
    )
      return pluralEntry;
    if (
      pluralEntry.endsWith("ies") &&
      `${pluralEntry.slice(0, -3)}y` === singularName
    )
      return pluralEntry;
  }
  return null;
}

function scanFolders(directoryPaths: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const dirPath of directoryPaths) {
    if (isExemptPath(dirPath)) continue;
    if (isExemptPackage(dirPath)) continue;
    const relPath = relative(REPO_ROOT, dirPath);
    if (!/^package\/[^/]+\/(src|docs|prisma\/seed)/.test(relPath)) continue;
    if (/^package\/[^/]+\/(src|docs)$/.test(relPath)) continue;

    const folderName = basename(dirPath);
    if (PLURAL_CONTAINER_ALLOWLIST.has(folderName)) continue;
    if (SINGULAR_DOMAIN_EXCEPTIONS.has(folderName)) continue;

    if (isLikelyPlural(folderName)) {
      violations.push({
        rule: "R4",
        path: relPath,
        message: `Plural folder "${folderName}" is not on the container allowlist — rename to singular or propose a spec amendment`,
        spec: SPEC_LINK.R4,
      });
      continue;
    }

    const expectedPluralForm = findAllowlistedPluralForm(folderName);
    if (expectedPluralForm) {
      violations.push({
        rule: "R3",
        path: relPath,
        message: `Singular folder "${folderName}" matches container allowlist entry "${expectedPluralForm}" — rename to "${expectedPluralForm}"`,
        spec: SPEC_LINK.R3,
      });
    }
  }

  return violations;
}

// ─── R5: raw <a href> scanning ──────────────────────────────────────────────

const R5_FILE_ALLOWLIST = new Set(["package/ui/src/link/SafeLink.tsx"]);

const RAW_ANCHOR_PATTERN = /<a\s[^>]*href=/g;

function scanRawAnchors(tsxFiles: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const filePath of tsxFiles) {
    const relPath = relative(REPO_ROOT, filePath);
    if (R5_FILE_ALLOWLIST.has(relPath)) continue;

    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (RAW_ANCHOR_PATTERN.test(lines[i]!)) {
        violations.push({
          rule: "R5",
          path: `${relPath}:${i + 1}`,
          message: `Raw <a href> found — use <SafeLink> from @rezics/ui instead`,
          spec: SPEC_LINK.R5,
        });
      }
      RAW_ANCHOR_PATTERN.lastIndex = 0;
    }
  }

  return violations;
}

// ─── R6: inline queryKey scanning ───────────────────────────────────────────

const INLINE_QUERY_KEY_PATTERN = /queryKey\s*:\s*\[/g;

function isR6TargetFile(absPath: string): boolean {
  const relPath = relative(REPO_ROOT, absPath);
  if (!/^package\/(app|admin|ui)\//.test(relPath)) return false;
  if (!/\.(ts|tsx)$/.test(relPath)) return false;
  if (/\.test\.tsx?$/.test(relPath)) return false;
  return true;
}

function scanInlineQueryKeys(candidateFiles: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const filePath of candidateFiles) {
    if (!isR6TargetFile(filePath)) continue;

    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const relPath = relative(REPO_ROOT, filePath);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (INLINE_QUERY_KEY_PATTERN.test(lines[i]!)) {
        violations.push({
          rule: "R6",
          path: `${relPath}:${i + 1}`,
          message:
            "Inline `queryKey: [` — move this key into a per-domain factory in package/api/src/<domain>/<domain>.keys.ts and consume it via a queryOptions / useQuery wrapper.",
          spec: SPEC_LINK.R6,
        });
      }
      INLINE_QUERY_KEY_PATTERN.lastIndex = 0;
    }
  }

  return violations;
}

// ─── R7: powerLaw isolation in factory/ ────────────────────────────────────

const R7_FACTORY_DIR = "package/server/prisma/factory";
const R7_FILE_ALLOWLIST = new Set([
  `${R7_FACTORY_DIR}/strategy.ts`,
  `${R7_FACTORY_DIR}/utils.ts`,
]);
const POWER_LAW_IMPORT_PATTERN =
  /^\s*import\s+(?:[^"';]+?\bpowerLaw\b[^"';]*?)\s+from\s+["'][^"']+["']/;

function isR7TargetFile(absPath: string): boolean {
  const relPath = relative(REPO_ROOT, absPath).replace(/\\/g, "/");
  if (!relPath.startsWith(`${R7_FACTORY_DIR}/`)) return false;
  if (!/\.ts$/.test(relPath)) return false;
  if (R7_FILE_ALLOWLIST.has(relPath)) return false;
  return true;
}

function scanPowerLawImports(candidateFiles: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const filePath of candidateFiles) {
    if (!isR7TargetFile(filePath)) continue;

    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const relPath = relative(REPO_ROOT, filePath).replace(/\\/g, "/");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (POWER_LAW_IMPORT_PATTERN.test(lines[i]!)) {
        violations.push({
          rule: "R7",
          path: `${relPath}:${i + 1}`,
          message:
            "Direct `powerLaw` import outside strategy.ts/utils.ts — count decisions must go through `ctx.draw(...)`.",
          spec: SPEC_LINK.R7,
        });
      }
    }
  }

  return violations;
}

// ─── Git staged-file helpers ────────────────────────────────────────────────

function getStagedFilePaths(): string[] {
  try {
    const gitOutput = execSync(
      "git diff --cached --name-only --diff-filter=ACMR",
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    return gitOutput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((relPath) => join(REPO_ROOT, relPath));
  } catch {
    return [];
  }
}

// ─── Snapshot baseline ──────────────────────────────────────────────────────

interface ViolationSnapshot {
  total: number;
  byRule: Record<Rule, number>;
  keys: string[];
}

function loadSnapshot(): ViolationSnapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as ViolationSnapshot;
  } catch {
    return null;
  }
}

function buildSnapshot(violations: Violation[]): ViolationSnapshot {
  const byRule: Record<Rule, number> = {
    R1: 0,
    R2: 0,
    R3: 0,
    R4: 0,
    R5: 0,
    R6: 0,
    R7: 0,
  };
  const keys: string[] = [];
  for (const violation of violations) {
    byRule[violation.rule]++;
    keys.push(`${violation.rule}  ${violation.path}`);
  }
  keys.sort();
  return { total: violations.length, byRule, keys };
}

function saveSnapshot(snapshot: ViolationSnapshot) {
  const snapshotWithNote = {
    _note:
      "TEMPORARY BASELINE. This snapshot exists only to block NEW violations from accumulating while a migration is in progress. Delete this file once the migration lands.",
    ...snapshot,
  };
  writeFileSync(
    SNAPSHOT_PATH,
    `${JSON.stringify(snapshotWithNote, null, 2)}\n`,
    "utf8",
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const cliFlags = new Set(process.argv.slice(2));
  const isStagedMode = cliFlags.has("--staged");
  const isSnapshotUpdate = cliFlags.has("--snapshot");

  const routeFiles: string[] = [];
  const folderPaths: string[] = [];
  const tsxFiles: string[] = [];
  const tsAndTsxFiles: string[] = [];

  if (isStagedMode) {
    const stagedPaths = getStagedFilePaths();
    for (const filePath of stagedPaths) {
      if (
        /\.api\.ts$/.test(filePath) &&
        !isExemptPath(filePath) &&
        !isExemptPackage(filePath)
      ) {
        routeFiles.push(filePath);
      }
      if (/\.tsx$/.test(filePath) && !isExemptPath(filePath)) {
        tsxFiles.push(filePath);
      }
      if (/\.(ts|tsx)$/.test(filePath) && !isExemptPath(filePath)) {
        tsAndTsxFiles.push(filePath);
      }
    }
    const affectedDirs = new Set<string>();
    for (const filePath of stagedPaths) {
      const parentDir = filePath.substring(0, filePath.lastIndexOf("/"));
      affectedDirs.add(parentDir);
      for (const subDir of walkDirectories(parentDir)) affectedDirs.add(subDir);
    }
    folderPaths.push(...affectedDirs);
  } else {
    const packagesRoot = join(REPO_ROOT, "package");
    for (const filePath of walkFilesByExtension(packagesRoot, /\.api\.ts$/)) {
      if (!isExemptPackage(filePath)) routeFiles.push(filePath);
    }
    for (const dirPath of walkDirectories(packagesRoot)) {
      folderPaths.push(dirPath);
    }
    for (const filePath of walkFilesByExtension(packagesRoot, /\.tsx$/)) {
      tsxFiles.push(filePath);
    }
    for (const filePath of walkFilesByExtension(packagesRoot, /\.(ts|tsx)$/)) {
      tsAndTsxFiles.push(filePath);
    }
  }

  const violations = [
    ...scanRoutes(routeFiles),
    ...scanFolders(folderPaths),
    ...scanRawAnchors(tsxFiles),
    ...scanInlineQueryKeys(tsAndTsxFiles),
    ...scanPowerLawImports(tsAndTsxFiles),
  ];
  const currentSnapshot = buildSnapshot(violations);

  if (isSnapshotUpdate) {
    saveSnapshot(currentSnapshot);
    const { R1, R2, R3, R4, R5, R6, R7 } = currentSnapshot.byRule;
    console.log(
      `Snapshot updated: ${currentSnapshot.total} violations (R1=${R1} R2=${R2} R3=${R3} R4=${R4} R5=${R5} R6=${R6} R7=${R7})`,
    );
    process.exit(0);
  }

  const baselineSnapshot = loadSnapshot();
  const baselineKeys = new Set(baselineSnapshot?.keys ?? []);
  const newViolations = violations.filter(
    (violation) => !baselineKeys.has(`${violation.rule}  ${violation.path}`),
  );

  if (violations.length === 0) {
    console.log("check:convention — 0 violations.");
    process.exit(0);
  }

  const baselineTotal = baselineSnapshot?.total ?? 0;
  const { R1, R2, R3, R4, R5, R6, R7 } = currentSnapshot.byRule;
  console.log(
    `check:convention — ${violations.length} violation(s) (baseline ${baselineTotal}):`,
  );
  console.log(
    `  R1=${R1}  R2=${R2}  R3=${R3}  R4=${R4}  R5=${R5}  R6=${R6}  R7=${R7}`,
  );

  if (newViolations.length > 0) {
    console.log(
      `\n${newViolations.length} NEW violation(s) beyond baseline:\n`,
    );
    for (const violation of newViolations) {
      console.log(`  [${violation.rule}] ${violation.path}`);
      console.log(`        ${violation.message}`);
      console.log(`        see ${violation.spec}`);
    }
    console.log(
      "\nFix new violations or update the baseline with: bun run check:convention -- --snapshot",
    );
    process.exit(1);
  }

  if (!isStagedMode) {
    console.log(
      "\nAll violations are in the baseline snapshot. Migration change will drive this to zero.",
    );
  }
  process.exit(0);
}

main();
