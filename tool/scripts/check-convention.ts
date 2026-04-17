#!/usr/bin/env bun
/**
 * Convention check for API routes and folder names.
 *
 * Rules enforced (see openspec/specs/ for normative source):
 * - R1  api-route-convention     — Elysia route prefixes must be singular
 * - R2  api-route-convention     — list/collection endpoints use /list suffix
 * - R3  folder-naming-convention — domain/feature folders are singular
 * - R4  folder-naming-convention — container folders are plural from allowlist
 *
 * Usage:
 *   bun run check:convention               # full scan
 *   bun run check:convention -- --staged   # only staged files
 *   bun run check:convention -- --snapshot # update expected-violations.json
 *
 * Exit code is 0 when no NEW violations beyond the baseline snapshot, 1 otherwise.
 * The baseline (expected-violations.json) is TEMPORARY — it exists only until the
 * api-route-and-folder-migration change eliminates all violations in one shot,
 * at which point this script and its baseline should be deleted.
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const SCRIPTS_DIR = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const SNAPSHOT_PATH = join(SCRIPTS_DIR, "expected-violations.json");

// ─── Allowlists ──────────────────────────────────────────────────────────────

/** Plural container folder names allowed under folder-naming-convention R4. */
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
  "docs",
  "templates",
]);

/**
 * Route prefix last-segment allowlist — non-resource names that are permitted
 * to end in a plural-looking form. These are service names, namespaces, or
 * compound English words, not resource plurals.
 */
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

/** Paths (glob-like prefixes) to skip during scanning. */
const EXEMPT_DIRS = [
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

/** Packages fully exempt from folder-naming checks. */
const EXEMPT_PACKAGES = new Set(["auth"]);

// ─── Types ───────────────────────────────────────────────────────────────────

type Rule = "R1" | "R2" | "R3" | "R4";

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
};

// ─── Folder walking ──────────────────────────────────────────────────────────

function isExemptPath(absPath: string): boolean {
  const rel = relative(REPO_ROOT, absPath);
  if (rel.startsWith("..")) return true;
  for (const part of EXEMPT_DIRS) {
    if (rel === part || rel.startsWith(`${part}/`) || rel.includes(`/${part}/`) || rel.endsWith(`/${part}`)) {
      return true;
    }
  }
  return false;
}

function isExemptPackage(absPath: string): boolean {
  const rel = relative(REPO_ROOT, absPath);
  const match = rel.match(/^package\/([^/]+)/);
  if (!match) return false;
  return EXEMPT_PACKAGES.has(match[1]);
}

function* walkDirs(root: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    const abs = join(root, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (isExemptPath(abs)) continue;
    yield abs;
    yield* walkDirs(abs);
  }
}

function* walkFiles(root: string, ext: RegExp): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    const abs = join(root, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (isExemptPath(abs)) continue;
      yield* walkFiles(abs, ext);
    } else if (ext.test(name)) {
      yield abs;
    }
  }
}

// ─── R1 + R2: route scan ─────────────────────────────────────────────────────

const PREFIX_RE = /new\s+Elysia\s*\(\s*\{[^}]*prefix\s*:\s*["']([^"']+)["']/g;
const LIST_ROOT_RE =
  /\.(get|post)\s*\(\s*["']\/["']\s*,/g;

function looksPluralResource(segment: string): boolean {
  if (ROUTE_PREFIX_ALLOWLIST.has(segment)) return false;
  if (segment.endsWith("ies")) return true;
  if (segment.endsWith("ses")) return true;
  if (segment.endsWith("es") && segment.length > 3) return true;
  if (segment.endsWith("s") && !segment.endsWith("ss") && segment.length > 2) return true;
  return false;
}

function scanRoutes(files: string[]): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    if (!/\.api\.ts$/.test(file)) continue;
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    PREFIX_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PREFIX_RE.exec(content))) {
      const prefix = m[1];
      const segments = prefix.split("/").filter(Boolean);
      for (const seg of segments) {
        if (looksPluralResource(seg)) {
          violations.push({
            rule: "R1",
            path: `${relative(REPO_ROOT, file)}  prefix="${prefix}"`,
            message: `Elysia prefix contains plural segment "${seg}" — use singular form`,
            spec: SPEC_LINK.R1,
          });
          break;
        }
      }
    }

    LIST_ROOT_RE.lastIndex = 0;
    while ((m = LIST_ROOT_RE.exec(content))) {
      const start = m.index;
      const precedingBlock = content.slice(Math.max(0, start - 120), start);
      if (precedingBlock.includes("@convention:root-list-ok")) continue;
      const handlerWindow = content.slice(start, start + 800);
      const returnsCollection =
        /items\s*:/.test(handlerWindow) ||
        /ListResponse/.test(handlerWindow) ||
        /Array<|: [A-Z]\w*\[\]/.test(handlerWindow);
      if (!returnsCollection) continue;
      violations.push({
        rule: "R2",
        path: `${relative(REPO_ROOT, file)}`,
        message: `${m[1].toUpperCase()} "/" likely returns a collection — move to "/list" or annotate with // @convention:root-list-ok`,
        spec: SPEC_LINK.R2,
      });
    }
  }
  return violations;
}

// ─── R3 + R4: folder scan ────────────────────────────────────────────────────

function isLikelyPlural(name: string): boolean {
  if (name.endsWith("ies")) return true;
  if (name.endsWith("ses")) return true;
  if (name.endsWith("es") && name.length > 3) return true;
  if (name.endsWith("s") && !name.endsWith("ss") && name.length > 2) return true;
  return false;
}

function singularOfAllowlisted(name: string): string | null {
  for (const plural of PLURAL_CONTAINER_ALLOWLIST) {
    if (plural === `${name}s` || plural === `${name}es`) return plural;
    if (plural.endsWith("ies") && plural.slice(0, -3) + "y" === name) return plural;
  }
  return null;
}

function scanFolders(dirs: string[]): Violation[] {
  const violations: Violation[] = [];
  for (const dir of dirs) {
    if (isExemptPath(dir)) continue;
    if (isExemptPackage(dir)) continue;
    const rel = relative(REPO_ROOT, dir);
    if (!/^package\/[^/]+\/(src|docs|prisma\/seed)/.test(rel)) continue;
    const name = basename(dir);
    if (/^package\/[^/]+\/(src|docs)$/.test(rel)) continue;

    if (PLURAL_CONTAINER_ALLOWLIST.has(name)) continue;

    if (isLikelyPlural(name)) {
      violations.push({
        rule: "R4",
        path: rel,
        message: `Plural folder "${name}" is not on the container allowlist — rename to singular or propose a spec amendment`,
        spec: SPEC_LINK.R4,
      });
      continue;
    }

    const allowlistedPlural = singularOfAllowlisted(name);
    if (allowlistedPlural) {
      violations.push({
        rule: "R3",
        path: rel,
        message: `Singular folder "${name}" matches container allowlist entry "${allowlistedPlural}" — rename to "${allowlistedPlural}"`,
        spec: SPEC_LINK.R3,
      });
    }
  }
  return violations;
}

// ─── Staged-mode helpers ─────────────────────────────────────────────────────

function stagedFiles(): string[] {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((p) => join(REPO_ROOT, p));
  } catch {
    return [];
  }
}

// ─── Snapshot baseline ───────────────────────────────────────────────────────

interface Snapshot {
  total: number;
  byRule: Record<Rule, number>;
  keys: string[];
}

function loadSnapshot(): Snapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}

function buildSnapshot(violations: Violation[]): Snapshot {
  const byRule: Record<Rule, number> = { R1: 0, R2: 0, R3: 0, R4: 0 };
  const keys: string[] = [];
  for (const v of violations) {
    byRule[v.rule]++;
    keys.push(`${v.rule}  ${v.path}`);
  }
  keys.sort();
  return { total: violations.length, byRule, keys };
}

function saveSnapshot(snap: Snapshot) {
  const marker = {
    _note:
      "TEMPORARY BASELINE. The api-route-and-folder-migration change is expected to eliminate every entry below in a single pass; after that, this file and tool/scripts/check-convention.ts SHOULD be deleted. This snapshot exists only to block NEW violations from accumulating in the interim.",
    ...snap,
  };
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(marker, null, 2) + "\n", "utf8");
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = new Set(process.argv.slice(2));
  const staged = args.has("--staged");
  const updateSnapshot = args.has("--snapshot");

  const scanFilesForRoutes: string[] = [];
  const scanDirs: string[] = [];

  if (staged) {
    const files = stagedFiles();
    for (const f of files) {
      if (/\.api\.ts$/.test(f) && !isExemptPath(f) && !isExemptPackage(f)) {
        scanFilesForRoutes.push(f);
      }
    }
    const dirSet = new Set<string>();
    for (const f of files) {
      const d = f.substring(0, f.lastIndexOf("/"));
      for (const dir of walkDirs(d)) dirSet.add(dir);
      dirSet.add(d);
    }
    scanDirs.push(...dirSet);
  } else {
    const packagesRoot = join(REPO_ROOT, "package");
    for (const f of walkFiles(packagesRoot, /\.api\.ts$/)) {
      if (!isExemptPackage(f)) scanFilesForRoutes.push(f);
    }
    for (const d of walkDirs(packagesRoot)) {
      scanDirs.push(d);
    }
  }

  const violations = [...scanRoutes(scanFilesForRoutes), ...scanFolders(scanDirs)];
  const current = buildSnapshot(violations);

  if (updateSnapshot) {
    saveSnapshot(current);
    console.log(`Snapshot updated: ${current.total} violations (R1=${current.byRule.R1} R2=${current.byRule.R2} R3=${current.byRule.R3} R4=${current.byRule.R4})`);
    process.exit(0);
  }

  const snap = loadSnapshot();
  const baseline = snap?.total ?? 0;
  const baselineKeys = new Set(snap?.keys ?? []);
  const newViolations = violations.filter((v) => !baselineKeys.has(`${v.rule}  ${v.path}`));

  if (violations.length === 0) {
    console.log("check:convention — 0 violations.");
    process.exit(0);
  }

  console.log(`check:convention — ${violations.length} violation(s) (baseline ${baseline}):`);
  console.log(`  R1=${current.byRule.R1}  R2=${current.byRule.R2}  R3=${current.byRule.R3}  R4=${current.byRule.R4}`);

  if (newViolations.length > 0) {
    console.log(`\n${newViolations.length} NEW violation(s) beyond baseline:\n`);
    for (const v of newViolations) {
      console.log(`  [${v.rule}] ${v.path}`);
      console.log(`        ${v.message}`);
      console.log(`        see ${v.spec}`);
    }
    console.log(`\nFix new violations or update the baseline with: bun run check:convention -- --snapshot`);
    process.exit(1);
  }

  if (!staged) {
    console.log("\nAll violations are in the baseline snapshot. Migration change will drive this to zero.");
  }
  process.exit(0);
}

main();
