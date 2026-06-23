#!/usr/bin/env bun
/**
 * Read the English language file and group keys by identical value.
 * Emit `tool/src/commands/i18n/dedup-report.json` listing each duplicate group
 * with its English value, member keys, and per-package call-site counts.
 *
 * Classification defaults to `accidental` when call sites span ≥3 distinct
 * underscore prefixes; reviewers can override by editing the report.
 *
 * 读取英文语言文件，并按相同值将键分组。
 * 生成 `tool/src/commands/i18n/dedup-report.json`，列出每个重复组及其英文值、
 * 成员键，以及按包统计的调用点计数。
 *
 * 当调用点跨越 ≥3 个不同的下划线前缀时，分类默认为 `accidental`；
 * 审阅者可通过编辑该报告进行覆盖。
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { resolveNamespace } from "./namespace-map.ts";

type CallSiteCounts = Record<string, number>;

type DuplicateGroup = {
  value: string;
  keys: string[];
  prefixes: string[];
  callSites: CallSiteCounts;
  classification: "semantic" | "accidental";
  reviewer: string | null;
};

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;
const EN_PATH = join(REPO_ROOT, "packages/frontend/src/lib/i18n/languages/en-US.ts");
const REPORT_PATH = join(REPO_ROOT, "tool/src/commands/i18n/dedup-report.json");
const SCAN_ROOTS = [
  "packages/frontend/src",
];

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
        if (name === "node_modules" || name === "dist" || name === ".turbo")
          continue;
        await visit(full);
      } else if (/\.(tsx?|jsx?)$/.test(name)) {
        out.push(full);
      }
    }
  }
  await visit(root);
  return out;
}

async function main(): Promise<void> {
  const raw = await readFile(EN_PATH, "utf8");
  const en = JSON.parse(raw) as Record<string, string>;

  const valueToKeys = new Map<string, string[]>();
  for (const [key, value] of Object.entries(en)) {
    if (key === "$schema") continue;
    if (typeof value !== "string") continue;
    const list = valueToKeys.get(value) ?? [];
    list.push(key);
    valueToKeys.set(value, list);
  }

  // Build a per-key call-site count by package.
  // 按包构建每个键的调用点计数。
  const filesByPackage = new Map<string, string[]>();
  for (const rel of SCAN_ROOTS) {
    const pkg = rel.split("/")[1] ?? "(root)";
    const files = await walk(join(REPO_ROOT, rel));
    filesByPackage.set(pkg, files);
  }

  const callSitesByKey = new Map<string, CallSiteCounts>();
  const callPattern = (key: string) => new RegExp(`\\bm\\.${key}\\b`, "g");

  for (const [pkg, files] of filesByPackage) {
    for (const file of files) {
      const content = await readFile(file, "utf8");
      for (const [value, keys] of valueToKeys) {
        if (keys.length <= 1) continue;
        for (const key of keys) {
          const matches = content.match(callPattern(key));
          if (!matches) continue;
          const counts = callSitesByKey.get(key) ?? {};
          counts[pkg] = (counts[pkg] ?? 0) + matches.length;
          callSitesByKey.set(key, counts);
        }
      }
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [value, keys] of valueToKeys) {
    if (keys.length <= 1) continue;
    const sortedKeys = keys.slice().sort();
    const prefixes = Array.from(
      new Set(
        sortedKeys.map((k) => {
          const i = k.indexOf("_");
          return i >= 0 ? k.slice(0, i) : k;
        }),
      ),
    ).sort();
    const callSites: CallSiteCounts = {};
    for (const key of sortedKeys) {
      const c = callSitesByKey.get(key);
      if (!c) continue;
      for (const [pkg, count] of Object.entries(c)) {
        callSites[pkg] = (callSites[pkg] ?? 0) + count;
      }
    }
    const namespaces = new Set(
      sortedKeys.map((k) => {
        try {
          return resolveNamespace(k);
        } catch {
          return "(unmapped)";
        }
      }),
    );
    const classification: DuplicateGroup["classification"] =
      prefixes.length >= 3 && namespaces.size > 1 ? "accidental" : "semantic";
    groups.push({
      value,
      keys: sortedKeys,
      prefixes,
      callSites,
      classification,
      reviewer: null,
    });
  }

  groups.sort(
    (a, b) => b.keys.length - a.keys.length || a.value.localeCompare(b.value),
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    totalKeys: Object.keys(en).filter((k) => k !== "$schema").length,
    duplicateGroupCount: groups.length,
    duplicateKeyCount: groups.reduce((n, g) => n + g.keys.length, 0),
    semanticGroups: groups.filter((g) => g.classification === "semantic")
      .length,
    accidentalGroups: groups.filter((g) => g.classification === "accidental")
      .length,
  };

  const report = { summary, groups };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(
    `i18n dedup: ${summary.duplicateGroupCount} groups / ${summary.duplicateKeyCount} keys; ` +
      `${summary.semanticGroups} semantic, ${summary.accidentalGroups} accidental. ` +
      `Report written to ${REPORT_PATH.replace(REPO_ROOT, ".")}.`,
  );
}

if (import.meta.main) {
  await main();
}
