#!/usr/bin/env bun
/**
 * codemod-theme-classes.ts
 *
 * Migrates long-form `(text|bg|border|ring|divide|outline)-rezics-color-*`
 * utility classes to the curated short-name API exposed by
 * `package/ui/src/config/uno-config.ts` `theme.colors`. See
 * `openspec/specs/convention-enforcement/spec.md` (R9) for the rule and
 * `openspec/changes/migrate-to-theme-config-classes/design.md` (Decision 2)
 * for the substitution-map schema.
 *
 * Substitutions are driven by `tool/scripts/migrate-theme-classes.map.json`.
 *
 * Modes:
 *   --dry-run         (default) print which files would change and how many
 *   --apply           write changes to disk
 *   --report-skipped  list dynamic-interpolation / inline-var() sites the
 *                     codemod cannot safely auto-rewrite
 *
 * Usage:
 *   bun tool/scripts/codemod-theme-classes.ts package/folio/src
 *   bun tool/scripts/codemod-theme-classes.ts --apply package/app/src/post
 *   bun tool/scripts/codemod-theme-classes.ts --report-skipped package
 *
 * The codemod operates on text via regex with non-word-character boundaries
 * so substring collisions are impossible (every map key contains
 * `rezics-color-`, which never appears as part of an unrelated identifier).
 * ts-morph is used only for the `--report-skipped` AST analysis. This is
 * permitted by the spec ("the implementation MAY fall back to a regex
 * pre-filter…").
 *
 * The script is idempotent: re-running on a file with zero matches leaves
 * the file untouched.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { Project, SyntaxKind } from "ts-morph";

const REPO_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const MAP_PATH = new URL("./migrate-theme-classes.map.json", import.meta.url)
  .pathname;

interface AmbiguousEntry {
  default: string;
  needs_review: boolean;
  comment: string;
}

interface Mapping {
  exact: Record<string, string>;
  ambiguous: Record<string, AmbiguousEntry>;
  varRewrite: Record<string, string>;
  var: Record<string, { suggestion: string; note: string } | string>;
}

const SOURCE_EXTENSIONS = /\.(tsx?|jsx?|mdx)$/;

const SKIP_PATH_PATTERNS: RegExp[] = [
  /\/node_modules\//,
  /\/dist\//,
  /\/build\//,
  /\/storybook-static\//,
  /\/\.output\//,
  /\/\.vite\//,
  /\/\.turbo\//,
  /\/coverage\//,
  /\/openspec\//,
  /\/\.git\//,
  /\.fixture\.[tj]sx?$/,
  /package\/ui\/src\/config\/tokens\.css$/,
  /tool\/scripts\/codemod-theme-classes/,
  /tool\/scripts\/migrate-theme-classes\.map\.json$/,
];

interface Args {
  mode: "dry-run" | "apply" | "report-skipped";
  targets: string[];
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let mode: Args["mode"] = "dry-run";
  if (argv.includes("--apply")) mode = "apply";
  else if (argv.includes("--report-skipped")) mode = "report-skipped";
  const targets = argv.filter((a) => !a.startsWith("--"));
  if (targets.length === 0) {
    console.error(
      "Usage: bun tool/scripts/codemod-theme-classes.ts [--apply | --dry-run | --report-skipped] <path>...",
    );
    process.exit(1);
  }
  return { mode, targets };
}

function loadMapping(): Mapping {
  return JSON.parse(readFileSync(MAP_PATH, "utf8")) as Mapping;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSkippedPath(absPath: string): boolean {
  const norm = absPath.replace(/\\/g, "/");
  return SKIP_PATH_PATTERNS.some((re) => re.test(norm));
}

function* walkSourceFiles(root: string): Generator<string> {
  let stat;
  try {
    stat = statSync(root);
  } catch {
    return;
  }
  if (stat.isFile()) {
    if (SOURCE_EXTENSIONS.test(root) && !isSkippedPath(root)) yield root;
    return;
  }
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(root, e);
    let s;
    try {
      s = statSync(p);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (isSkippedPath(`${p}/`)) continue;
      yield* walkSourceFiles(p);
    } else if (SOURCE_EXTENSIONS.test(e) && !isSkippedPath(p)) {
      yield p;
    }
  }
}

interface Substitution {
  re: RegExp;
  to: string;
  ambiguous: boolean;
  ambiguousComment?: string;
}

function buildSubstitutions(mapping: Mapping): Substitution[] {
  const subs: Substitution[] = [];
  // Order longer keys first so e.g. "text-rezics-color-text-error" runs before
  // any key that is a prefix of it (none exist today, but defensive).
  const exactKeys = Object.keys(mapping.exact).sort(
    (a, b) => b.length - a.length,
  );
  for (const k of exactKeys) {
    subs.push({
      re: new RegExp(`(?<![A-Za-z0-9_-])${escapeRegex(k)}(?![A-Za-z0-9_-])`, "g"),
      to: mapping.exact[k]!,
      ambiguous: false,
    });
  }
  const ambKeys = Object.keys(mapping.ambiguous).sort(
    (a, b) => b.length - a.length,
  );
  for (const k of ambKeys) {
    const entry = mapping.ambiguous[k]!;
    subs.push({
      re: new RegExp(`(?<![A-Za-z0-9_-])${escapeRegex(k)}(?![A-Za-z0-9_-])`, "g"),
      to: entry.default,
      ambiguous: true,
      ambiguousComment: entry.comment,
    });
  }
  // varRewrite: alias-level rewrites (var(--rezics-color-X) → var(--rezics-sys-color-Y))
  // and bare CSS-variable-name rewrites. Skip the leading "_note" key.
  const varRewriteKeys = Object.keys(mapping.varRewrite ?? {})
    .filter((k) => !k.startsWith("_"))
    .sort((a, b) => b.length - a.length);
  for (const k of varRewriteKeys) {
    subs.push({
      re: new RegExp(`(?<![A-Za-z0-9_-])${escapeRegex(k)}(?![A-Za-z0-9_-])`, "g"),
      to: mapping.varRewrite[k]!,
      ambiguous: false,
    });
  }
  return subs;
}

interface FileResult {
  file: string;
  subs: number;
  ambiguous: number;
  next: string;
}

function applyToFile(
  file: string,
  subs: Substitution[],
): FileResult | null {
  const orig = readFileSync(file, "utf8");
  let next = orig;
  let totalSubs = 0;
  let ambSubs = 0;
  for (const s of subs) {
    next = next.replace(s.re, () => {
      totalSubs++;
      if (s.ambiguous) ambSubs++;
      return s.to;
    });
  }
  if (next === orig) return null;
  return { file, subs: totalSubs, ambiguous: ambSubs, next };
}

interface SkippedSite {
  file: string;
  line: number;
  text: string;
  kind: "dynamic-template" | "inline-var" | "concat" | "other";
}

function detectSkippedSites(file: string): SkippedSite[] {
  if (!/\.(tsx?|jsx?)$/.test(file)) return [];
  const sites: SkippedSite[] = [];
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  let sf;
  try {
    sf = project.addSourceFileAtPath(file);
  } catch {
    return [];
  }
  // Template expressions whose static segments contain a partial match of
  // "rezics-color-" but the dynamic parts mean we can't safely rewrite.
  const templates = sf.getDescendantsOfKind(SyntaxKind.TemplateExpression);
  for (const t of templates) {
    const text = t.getText();
    if (text.includes("rezics-color-")) {
      const { line } = sf.getLineAndColumnAtPos(t.getStart());
      sites.push({
        file: relative(REPO_ROOT, file),
        line,
        text: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        kind: "dynamic-template",
      });
    }
  }
  // Binary expressions (concatenation) involving rezics-color- partials.
  const bins = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  for (const b of bins) {
    if (b.getOperatorToken().getText() !== "+") continue;
    const text = b.getText();
    if (text.includes("rezics-color-")) {
      const { line } = sf.getLineAndColumnAtPos(b.getStart());
      sites.push({
        file: relative(REPO_ROOT, file),
        line,
        text: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        kind: "concat",
      });
    }
  }
  // Any string literal containing var(--rezics-color-*) — codemod doesn't
  // auto-rewrite these (per spec, they need human judgement).
  const strs = [
    ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ];
  for (const s of strs) {
    const text = s.getText();
    if (text.includes("var(--rezics-color-") || text.includes("var(--rezics-sys-color-")) {
      const { line } = sf.getLineAndColumnAtPos(s.getStart());
      sites.push({
        file: relative(REPO_ROOT, file),
        line,
        text: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        kind: "inline-var",
      });
    }
  }
  return sites;
}

function main() {
  const { mode, targets } = parseArgs();
  const mapping = loadMapping();
  const subs = buildSubstitutions(mapping);

  const files: string[] = [];
  for (const t of targets) {
    const abs = t.startsWith("/") ? t : join(process.cwd(), t);
    for (const f of walkSourceFiles(abs)) files.push(f);
  }

  if (mode === "report-skipped") {
    const sites: SkippedSite[] = [];
    for (const f of files) sites.push(...detectSkippedSites(f));
    const byKind: Record<string, number> = {};
    for (const s of sites) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
    console.log(`\n${sites.length} skipped site(s) across ${files.length} file(s).`);
    for (const [k, c] of Object.entries(byKind)) console.log(`  ${k}: ${c}`);
    console.log("");
    for (const s of sites) {
      console.log(`  [${s.kind}] ${s.file}:${s.line}`);
      console.log(`     ${s.text}`);
    }
    return;
  }

  let changedFiles = 0;
  let totalSubs = 0;
  let totalAmbiguous = 0;
  const ambiguousFiles: string[] = [];
  const changedFileList: string[] = [];

  for (const file of files) {
    const r = applyToFile(file, subs);
    if (!r) continue;
    changedFiles++;
    totalSubs += r.subs;
    totalAmbiguous += r.ambiguous;
    const rel = relative(REPO_ROOT, file);
    changedFileList.push(rel);
    if (r.ambiguous > 0) ambiguousFiles.push(rel);
    if (mode === "apply") writeFileSync(file, r.next, "utf8");
    if (mode === "dry-run") {
      console.log(
        `${r.ambiguous > 0 ? "?" : "~"} ${rel}: ${r.subs} sub(s)${r.ambiguous > 0 ? ` (${r.ambiguous} ambiguous)` : ""}`,
      );
    }
  }

  console.log(
    `\n${mode === "apply" ? "Modified" : "Would modify"} ${changedFiles} file(s); ${totalSubs} substitution(s) total; ${totalAmbiguous} ambiguous.`,
  );
  if (totalAmbiguous > 0) {
    console.log(
      "\nAmbiguous-class call-sites need human review. See migrate-theme-classes.map.json `ambiguous` block for guidance:",
    );
    for (const f of ambiguousFiles) console.log(`  ${f}`);
  }
}

main();
