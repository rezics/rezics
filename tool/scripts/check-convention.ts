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
 * - R9  ui-component-foundation   — token consumption goes through uno-config theme.colors
 *                                   short names. Bans any `var(--rezics-…)` reference and
 *                                   the (now-removed) hand-written `package/ui/src/config/
 *                                   tokens.css`. The flat `--colors-*` / `--radius-*` /
 *                                   `--shadow-*` / `--font-*` / `--duration-*` /
 *                                   `--easing-*` namespace emitted by uno-config.ts is
 *                                   the only sanctioned CSS-variable surface.
 * - R10 user-namespace-slug        — short-prefix routes (/u, /r, /t, /z, /e) take a slug;
 *                                   long-prefix routes (/user, /realm, /tag, /zone, /entity,
 *                                   /unit) take a unitId. A param under a short prefix whose
 *                                   name looks like an id, or a param under a long prefix
 *                                   whose name looks like a slug, is flagged.
 * - R11 paraglide-static-access    — no dynamic access to generated Paraglide messages.
 * - R12 contract-i18n-keys         — no i18nKey fields in contract domain objects and no
 *                                   t(*.i18nKey) callsites. Also bans legacy
 *                                   frontend string-key translation APIs.
 * - R13 ui-package-autonomy        — core @rezics/ui cannot import host runtime deps.
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
  "stories",
  "decorators",
  "corpus",
  "labels",
  "messages",
]);

// Singular domain folder names that are permitted even when their plural form
// is on PLURAL_CONTAINER_ALLOWLIST, or when the heuristic incorrectly flags a
// compound whose head noun is genuinely singular but ends in `s` (e.g.
// "status"). Example: `token/` is the JWT/auth-token domain; `tokens/` is the
// design-token container. `progress-status/` is the progress-status feature
// folder — "status" is singular but the heuristic flags any `s` ending.
const SINGULAR_DOMAIN_EXCEPTIONS = new Set(["token", "progress-status"]);

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

type Rule =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R9"
  | "R10"
  | "R11"
  | "R12"
  | "R13";

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
  R9: "openspec/specs/ui-component-foundation/spec.md",
  R10: "openspec/changes/user-namespace-slug/proposal.md",
  R11: "openspec/specs/i18n-toolchain/spec.md",
  R12: "openspec/specs/i18n-toolchain/spec.md",
  R13: "openspec/changes/make-ui-package-standalone/specs/ui-package-autonomy/spec.md",
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

const R5_FILE_ALLOWLIST = new Set([
  "package/ui/src/link/SafeLink.tsx",
  "package/ui/src/primitive/link/Link.tsx",
  "package/ui/src/primitive/link/TextLink.tsx",
]);

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

// ─── R13: @rezics/ui package autonomy ──────────────────────────────────────

const UI_FORBIDDEN_HOST_IMPORT_PATTERN =
  /from\s+["'](@tanstack\/react-router|@rezics\/api(?:\/[^"']*)?|@rezics\/server(?:\/[^"']*)?|@rezics\/app(?:\/[^"']*)?|@rezics\/admin(?:\/[^"']*)?)["']|import\s*\(\s*["'](@tanstack\/react-router|@rezics\/api(?:\/[^"']*)?|@rezics\/server(?:\/[^"']*)?|@rezics\/app(?:\/[^"']*)?|@rezics\/admin(?:\/[^"']*)?)["']\s*\)/g;

function isUiAutonomyAllowedPath(relPath: string): boolean {
  return (
    /\.stories\.tsx?$/.test(relPath) ||
    /\.test\.tsx?$/.test(relPath) ||
    relPath.startsWith("package/ui/src/mocks/")
  );
}

function scanUiPackageAutonomy(candidateFiles: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const filePath of candidateFiles) {
    const relPath = relative(REPO_ROOT, filePath);
    if (!relPath.startsWith("package/ui/src/")) continue;
    if (isUiAutonomyAllowedPath(relPath)) continue;

    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (UI_FORBIDDEN_HOST_IMPORT_PATTERN.test(lines[i]!)) {
        violations.push({
          rule: "R13",
          path: `${relPath}:${i + 1}`,
          message:
            "Core @rezics/ui source imports a host runtime dependency — inject the capability or move the integration to an app/admin wrapper",
          spec: SPEC_LINK.R13,
        });
      }
      UI_FORBIDDEN_HOST_IMPORT_PATTERN.lastIndex = 0;
    }
  }

  try {
    const content = readFileSync(
      join(REPO_ROOT, "package/ui/src/shadcn/index.ts"),
      "utf8",
    );
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/from\s+["']\.\/sections["']/.test(lines[i]!)) {
        violations.push({
          rule: "R13",
          path: `package/ui/src/shadcn/index.ts:${i + 1}`,
          message:
            "@rezics/ui/shadcn must not re-export demo/dashboard sections from the primitive barrel",
          spec: "openspec/changes/make-ui-package-standalone/specs/ui-component-foundation/spec.md",
        });
      }
    }
  } catch {
    // Ignore missing barrel in partial worktrees.
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

// ─── R9: token-consumption convention ──────────────────────────────────────

const R9_FILE_ALLOWLIST = new Set<string>([
  // SVG-inline / chart-fill exceptions go here. Every entry SHALL have a
  // companion comment explaining why a UnoCSS shortcut cannot yet replace it.
  // The list is reviewed quarterly and SHALL shrink over time.
]);

// Match any `--rezics-*` CSS variable reference. The whole namespace was
// retired by the unify-tokens-single-source openspec change; the flat
// `--colors-*` / `--radius-*` / `--shadow-*` / `--font-*` / `--duration-*` /
// `--easing-*` surface emitted by `package/ui/src/config/uno-config.ts` is the
// only sanctioned form.
const R9_REZICS_VAR_PATTERN = /var\(\s*--rezics-[a-zA-Z0-9_-]+/;

// `package/ui/src/config/tokens.css` SHALL NOT exist — the tokens TS source is
// authoritative and uno-config.ts emits the runtime CSS variables.
const R9_TOKENS_CSS_PATH = join(REPO_ROOT, "package/ui/src/config/tokens.css");

function isR9TargetFile(absPath: string): boolean {
  const relPath = relative(REPO_ROOT, absPath).replace(/\\/g, "/");
  if (!/^package\/[^/]+\/src\//.test(relPath)) return false;
  if (!/\.(tsx?|jsx?|mdx|css)$/.test(relPath)) return false;
  if (/\.fixture\.[tj]sx?$/.test(relPath)) return false;
  return true;
}

function scanTokenConsumption(candidateFiles: string[]): Violation[] {
  const violations: Violation[] = [];

  if (existsSync(R9_TOKENS_CSS_PATH)) {
    violations.push({
      rule: "R9",
      path: "package/ui/src/config/tokens.css",
      message:
        "`tokens.css` is forbidden — design tokens live in `package/ui/src/config/tokens/*.ts` and are emitted as flat CSS variables by `uno-config.ts`. Delete this file.",
      spec: SPEC_LINK.R9,
    });
  }

  for (const filePath of candidateFiles) {
    if (!isR9TargetFile(filePath)) continue;
    const relPath = relative(REPO_ROOT, filePath).replace(/\\/g, "/");
    if (R9_FILE_ALLOWLIST.has(relPath)) continue;

    let content: string;
    try {
      content = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = line.match(R9_REZICS_VAR_PATTERN);
      if (match) {
        violations.push({
          rule: "R9",
          path: `${relPath}:${i + 1}`,
          message: `Forbidden \`${match[0]})\` — the \`--rezics-*\` namespace was retired. Use the flat CSS variable surface emitted by \`uno-config.ts\` (e.g. \`var(--colors-text-primary)\`, \`var(--radius-md)\`, \`var(--shadow-modal)\`) or the curated short-name className (\`text-primary\`, \`bg-surface-elevated\`).`,
          spec: SPEC_LINK.R9,
        });
      }
    }
  }

  return violations;
}

// ─── R10: short=slug / long=unitId route convention ────────────────────────

const SHORT_SLUG_PREFIXES = new Set(["u", "r", "t", "z", "e"]);
const LONG_ID_PREFIXES = new Set([
  "user",
  "realm",
  "tag",
  "zone",
  "entity",
  "unit",
]);

const ID_PARAM_NAME_PATTERN = /Id$|Uuid$/;
const SLUG_PARAM_NAME_PATTERN = /Slug$|^slug$/;

const ROUTE_HANDLER_PATH_PATTERN =
  /\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g;

function scanShortLongSlugConvention(apiFiles: string[]): Violation[] {
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

    const prefixes: string[] = [];
    for (const prefixMatch of fileContent.matchAll(ELYSIA_PREFIX_PATTERN)) {
      prefixes.push(prefixMatch[1]!);
    }

    for (const prefix of prefixes) {
      const head = prefix.split("/").filter(Boolean)[0];
      if (!head) continue;
      const isShort = SHORT_SLUG_PREFIXES.has(head);
      const isLong = LONG_ID_PREFIXES.has(head);
      if (!isShort && !isLong) continue;

      for (const handlerMatch of fileContent.matchAll(
        ROUTE_HANDLER_PATH_PATTERN,
      )) {
        const path = handlerMatch[2]!;
        if (isLong && /^\/by-slug\/:slug\/?$/.test(path)) continue;
        const segments = path.split("/").filter(Boolean);
        for (const segment of segments) {
          if (!segment.startsWith(":")) continue;
          const paramName = segment.slice(1).replace(/\?$/, "");

          if (isShort && ID_PARAM_NAME_PATTERN.test(paramName)) {
            violations.push({
              rule: "R10",
              path: `${relFilePath}  ${prefix}${path}`,
              message: `short-prefix \`/${head}\` route param \`:${paramName}\` looks like an id — short prefixes take slugs, use long-prefix \`/${head === "u" ? "user" : head === "r" ? "realm" : head === "t" ? "tag" : head === "z" ? "zone" : "entity"}/:unitId\` for id lookups`,
              spec: SPEC_LINK.R10,
            });
          }
          if (isLong && SLUG_PARAM_NAME_PATTERN.test(paramName)) {
            const expectedShort =
              head === "user"
                ? "u"
                : head === "realm"
                  ? "r"
                  : head === "tag"
                    ? "t"
                    : head === "zone"
                      ? "z"
                      : head === "entity"
                        ? "e"
                        : null;
            if (expectedShort) {
              violations.push({
                rule: "R10",
                path: `${relFilePath}  ${prefix}${path}`,
                message: `long-prefix \`/${head}\` route param \`:${paramName}\` looks like a slug — long prefixes take unitIds; use short-prefix \`/${expectedShort}/:${paramName}\` or the typed \`/${head}/by-slug/:slug\` endpoint for slug lookups`,
                spec: SPEC_LINK.R10,
              });
            }
          }
        }
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

// ─── R11 + R12: i18n invariants ─────────────────────────────────────────────

function scanI18nInvariants(filePaths: string[]): Violation[] {
  const violations: Violation[] = [];
  const dynamicMessagePattern =
    /\bm\s*\[\s*(?!["'][A-Za-z0-9_.-]+["'])|const\s+\{[^}]+\}\s*=\s*m\b/;
  const i18nKeyCallPattern = /\bt\s*\([^)]*\.i18nKey\b/;
  const contractI18nKeyPattern = /\bi18nKey\s*:/;
  const frontendSourcePattern =
    /^package\/(?:app|admin|ui|editor|folio)\/src\/.*\.(?:ts|tsx)$/;
  const legacyUseTranslationPattern =
    /from\s+["']@rezics\/i18n\/react["'][\s\S]*?\buseTranslation\b|\buseTranslation\s*\(/;
  const legacyTranslatePattern =
    /from\s+["']@rezics\/i18n["'][\s\S]*?\btranslate\b|\btranslate\s*\(/;
  const legacyFallbackPattern =
    /\bt\s*\(\s*["'][^"']+["']\s*,\s*["'][^"']+["']/;

  for (const filePath of filePaths) {
    const relFilePath = relative(REPO_ROOT, filePath);
    if (relFilePath === "tool/scripts/check-convention.ts") continue;

    const source = readFileSync(filePath, "utf8");

    if (
      source.includes("paraglide/messages") &&
      dynamicMessagePattern.test(source)
    ) {
      violations.push({
        rule: "R11",
        path: relFilePath,
        message:
          "generated Paraglide messages must be referenced statically; route dynamic discriminators through explicit label maps",
        spec: SPEC_LINK.R11,
      });
    }

    if (i18nKeyCallPattern.test(source)) {
      violations.push({
        rule: "R12",
        path: relFilePath,
        message:
          "`t(*.i18nKey)` is forbidden; use @rezics/i18n label helpers instead",
        spec: SPEC_LINK.R12,
      });
    }

    if (frontendSourcePattern.test(relFilePath)) {
      if (legacyUseTranslationPattern.test(source)) {
        violations.push({
          rule: "R12",
          path: relFilePath,
          message:
            "`useTranslation().t(...)` is forbidden for frontend UI copy; import generated Paraglide functions or use useLocale for locale state",
          spec: SPEC_LINK.R12,
        });
      }

      if (legacyTranslatePattern.test(source)) {
        violations.push({
          rule: "R12",
          path: relFilePath,
          message:
            "`translate(...)` is forbidden for frontend UI copy; import generated Paraglide functions or typed label helpers",
          spec: SPEC_LINK.R12,
        });
      }

      if (legacyFallbackPattern.test(source)) {
        violations.push({
          rule: "R12",
          path: relFilePath,
          message:
            "fallback string translation calls are forbidden; add the message to the JSON catalog and call the generated function",
          spec: SPEC_LINK.R12,
        });
      }
    }

    if (
      relFilePath.startsWith("package/contract/src/") &&
      contractI18nKeyPattern.test(source)
    ) {
      violations.push({
        rule: "R12",
        path: relFilePath,
        message:
          "contract domain objects must not define i18nKey fields; message identity belongs in @rezics/i18n",
        spec: SPEC_LINK.R12,
      });
    }
  }

  return violations;
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
    R9: 0,
    R10: 0,
    R11: 0,
    R12: 0,
    R13: 0,
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
  const r9CandidateFiles: string[] = [];

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
      if (/\.(tsx?|jsx?|mdx)$/.test(filePath) && !isExemptPath(filePath)) {
        r9CandidateFiles.push(filePath);
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
    for (const filePath of walkFilesByExtension(
      packagesRoot,
      /\.(tsx?|jsx?|mdx)$/,
    )) {
      r9CandidateFiles.push(filePath);
    }
  }

  const violations = [
    ...scanRoutes(routeFiles),
    ...scanFolders(folderPaths),
    ...scanRawAnchors(tsxFiles),
    ...scanInlineQueryKeys(tsAndTsxFiles),
    ...scanPowerLawImports(tsAndTsxFiles),
    ...scanTokenConsumption(r9CandidateFiles),
    ...scanShortLongSlugConvention(routeFiles),
    ...scanI18nInvariants(tsAndTsxFiles),
    ...scanUiPackageAutonomy(tsAndTsxFiles),
  ];
  const currentSnapshot = buildSnapshot(violations);

  if (isSnapshotUpdate) {
    saveSnapshot(currentSnapshot);
    const { R1, R2, R3, R4, R5, R6, R7, R9, R10, R11, R12, R13 } =
      currentSnapshot.byRule;
    console.log(
      `Snapshot updated: ${currentSnapshot.total} violations (R1=${R1} R2=${R2} R3=${R3} R4=${R4} R5=${R5} R6=${R6} R7=${R7} R9=${R9} R10=${R10} R11=${R11} R12=${R12} R13=${R13})`,
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
  const { R1, R2, R3, R4, R5, R6, R7, R9, R10, R11, R12, R13 } =
    currentSnapshot.byRule;
  console.log(
    `check:convention — ${violations.length} violation(s) (baseline ${baselineTotal}):`,
  );
  console.log(
    `  R1=${R1}  R2=${R2}  R3=${R3}  R4=${R4}  R5=${R5}  R6=${R6}  R7=${R7}  R9=${R9}  R10=${R10}  R11=${R11}  R12=${R12}  R13=${R13}`,
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
