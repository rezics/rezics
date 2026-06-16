#!/usr/bin/env bun
/**
 * Static validation of i18next namespace JSON against frontend call sites.
 * 针对前端调用点对 i18next 命名空间 JSON 进行静态校验。
 *
 * Reports:
 * 报告：
 *  - **Missing keys**: `t('<ns>:<key>')` referenced in source but absent from
 *    the namespace JSON for `en` (the base locale).
 *    **缺失的键**：源码中引用了 `t('<ns>:<key>')`，但在基准语言 `en` 的命名空间
 *    JSON 中不存在。
 *  - **Per-locale gaps**: a key present in `en/<ns>.json` but missing in
 *    another locale's `<ns>.json`.
 *    **各语言缺口**：某个键存在于 `en/<ns>.json`，但在另一语言的 `<ns>.json`
 *    中缺失。
 *  - **Unused keys**: a key present in `en/<ns>.json` not referenced from any
 *    scanned source file (advisory, made fatal by `--strict-unused`).
 *    **未使用的键**：某个键存在于 `en/<ns>.json`，但未被任何扫描到的源文件引用
 *    （仅作提示，加 `--strict-unused` 时变为致命错误）。
 *  - **Dynamic key usage**: `t(varKey)` patterns where `varKey` is not a
 *    string literal — flagged for manual review.
 *    **动态键用法**：`t(varKey)` 模式中 `varKey` 不是字符串字面量 —— 标记以供
 *    人工审查。
 *
 * Exit codes: 0 on success; 1 on missing/gap errors; 2 on dynamic-key
 * findings; 3 on unused keys when `--strict-unused` is set.
 * 退出码：成功为 0；缺失/缺口错误为 1；动态键发现为 2；设置 `--strict-unused`
 * 时存在未使用的键为 3。
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  I18N_LOCALES_ROOT,
  REPO_ROOT,
  toRepoRelPath,
  UI_LOCALES_ROOT,
} from "../core/paths";

const SCAN_ROOTS = [
  "package/app/src",
  "package/admin/src",
  "package/ui/src",
  "package/editor/src",
  "package/folio/src",
  "package/i18n/src",
];
const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".storybook"]);
const TARGET_EXT = /\.(tsx?|jsx?)$/;

const args = new Set(process.argv.slice(2));
const STRICT_UNUSED = args.has("--strict-unused");

async function walk(root: string): Promise<string[]> {
  const out: string[] = [];
  async function visit(dir: string) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      const st = await stat(full);
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name)) continue;
        await visit(full);
      } else if (TARGET_EXT.test(name)) {
        out.push(full);
      }
    }
  }
  await visit(root);
  return out;
}

type Catalog = Record<string, Record<string, Record<string, string>>>;

async function loadCatalog(): Promise<{
  catalog: Catalog;
  locales: string[];
  namespaces: string[];
}> {
  const catalog: Catalog = {};
  const locales = await readdir(I18N_LOCALES_ROOT);
  const namespaces = new Set<string>();
  for (const lng of locales) {
    catalog[lng] = {};
    const lngDir = join(I18N_LOCALES_ROOT, lng);
    for (const file of await readdir(lngDir)) {
      const ns = file.replace(/\.json$/, "");
      namespaces.add(ns);
      const raw = await readFile(join(lngDir, file), "utf8");
      catalog[lng][ns] = JSON.parse(raw) as Record<string, string>;
    }
  }
  // UI namespace lives in `package/ui/locales/{locale}.ts`.
  // UI 命名空间位于 `package/ui/locales/{locale}.ts`。
  try {
    for (const lng of locales) {
      const path = join(UI_LOCALES_ROOT, `${lng}.ts`);
      try {
        const mod = (await import(path)) as { default: Record<string, string> };
        catalog[lng]!.ui = mod.default;
        namespaces.add("ui");
      } catch {
        catalog[lng]!.ui = catalog[lng]!.ui ?? {};
      }
    }
  } catch {
    // ignore
    // 忽略
  }
  return { catalog, locales, namespaces: Array.from(namespaces).sort() };
}

type Reference = { ns: string; key: string; file: string; line: number };

const T_CALL_RE = /\bt\(\s*["'`]([a-z][a-z0-9_-]*)\s*:\s*([^"'`)]+)["'`]/g;
// Dynamic-key detection. `t(MAP[slug])` is the blessed pattern (typed maps),
// so we only flag bare identifiers and template literals — not bracketed
// indexing.
// 动态键检测。`t(MAP[slug])` 是认可的模式（类型化的映射表），因此我们只标记
// 裸标识符和模板字面量 —— 不标记方括号索引。
const T_DYNAMIC_RE = /\bt\(\s*([A-Za-z_]\w*)\s*[,)]/g;
const T_TEMPLATE_RE = /\bt\(\s*`([^`]*\$\{[^`]*)`/g;

async function scanSources(): Promise<{
  references: Reference[];
  dynamic: { file: string; line: number; expr: string }[];
}> {
  const references: Reference[] = [];
  const dynamic: { file: string; line: number; expr: string }[] = [];
  for (const rel of SCAN_ROOTS) {
    const files = await walk(join(REPO_ROOT, rel));
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const lines = source.split("\n");
      for (const m of source.matchAll(T_CALL_RE)) {
        const before = source.slice(0, m.index!);
        const line = before.split("\n").length;
        references.push({ ns: m[1]!, key: m[2]!.trim(), file, line });
      }
      for (const m of source.matchAll(T_DYNAMIC_RE)) {
        const expr = m[1]!;
        if (/^["'`]/.test(expr) || expr.startsWith("{")) continue;
        const before = source.slice(0, m.index!);
        const line = before.split("\n").length;
        dynamic.push({ file, line, expr });
        void lines;
      }
      for (const m of source.matchAll(T_TEMPLATE_RE)) {
        const before = source.slice(0, m.index!);
        const line = before.split("\n").length;
        dynamic.push({ file, line, expr: `\`${m[1]!}…\`` });
      }
    }
  }
  return { references, dynamic };
}

function relRepo(p: string): string {
  return toRepoRelPath(p);
}

async function main(): Promise<void> {
  const { catalog, locales, namespaces } = await loadCatalog();
  const { references, dynamic } = await scanSources();

  const base = catalog.en ?? {};
  const referencedByNs = new Map<string, Set<string>>();
  const missing: Reference[] = [];

  for (const ref of references) {
    const bag = base[ref.ns];
    if (!bag) {
      missing.push(ref);
      continue;
    }
    if (!(ref.key in bag)) {
      missing.push(ref);
      continue;
    }
    let set = referencedByNs.get(ref.ns);
    if (!set) {
      set = new Set();
      referencedByNs.set(ref.ns, set);
    }
    set.add(ref.key);
  }

  const gaps: { lng: string; ns: string; key: string }[] = [];
  for (const lng of locales) {
    if (lng === "en") continue;
    for (const ns of namespaces) {
      const baseBag = base[ns] ?? {};
      const lngBag = catalog[lng]?.[ns] ?? {};
      for (const key of Object.keys(baseBag)) {
        if (!(key in lngBag)) gaps.push({ lng, ns, key });
      }
    }
  }

  const unused: { ns: string; key: string }[] = [];
  for (const ns of namespaces) {
    const baseBag = base[ns] ?? {};
    const referenced = referencedByNs.get(ns) ?? new Set<string>();
    for (const key of Object.keys(baseBag)) {
      if (!referenced.has(key)) unused.push({ ns, key });
    }
  }

  let exit = 0;

  if (missing.length) {
    console.error(`\ncheck:i18n: missing keys (${missing.length}):`);
    for (const m of missing.slice(0, 50)) {
      console.error(`  ${relRepo(m.file)}:${m.line}  ${m.ns}:${m.key}`);
    }
    if (missing.length > 50) {
      console.error(`  …and ${missing.length - 50} more`);
    }
    exit = Math.max(exit, 1);
  }
  if (gaps.length) {
    console.error(`\ncheck:i18n: per-locale gaps (${gaps.length}):`);
    const byLng = new Map<string, number>();
    for (const g of gaps) byLng.set(g.lng, (byLng.get(g.lng) ?? 0) + 1);
    for (const [lng, n] of byLng) console.error(`  ${lng}: ${n} keys`);
    exit = Math.max(exit, 1);
  }
  if (dynamic.length) {
    console.error(`\ncheck:i18n: dynamic-key sites (${dynamic.length}):`);
    for (const d of dynamic.slice(0, 30)) {
      console.error(`  ${relRepo(d.file)}:${d.line}  ${d.expr}`);
    }
    exit = Math.max(exit, 2);
  }
  if (unused.length) {
    const level = STRICT_UNUSED ? "error" : "warn";
    console[level === "error" ? "error" : "warn"](
      `\ncheck:i18n: unused keys (${unused.length})${STRICT_UNUSED ? "" : " — advisory"}`,
    );
    if (STRICT_UNUSED) exit = Math.max(exit, 3);
  }

  if (exit === 0) {
    console.log(
      `check:i18n: ${references.length} call sites, ${namespaces.length} namespaces, ${locales.length} locales — OK.`,
    );
  }
  process.exitCode = exit;
}

if (import.meta.main) {
  await main();
}
