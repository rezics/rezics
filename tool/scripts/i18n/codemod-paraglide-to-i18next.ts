#!/usr/bin/env bun
/**
 * Codemod that rewrites Paraglide `m.<key>()` call sites to i18next
 * `t('<ns>:<key>')` form. Operates over `package/{app,admin,ui,editor,folio}/src`.
 *
 * Algorithm (per file):
 *  1. Skip if file does not import from `@rezics/i18n/messages` and does not
 *     call `useMessage` or use `m.<key>` patterns.
 *  2. Identify imported message keys (named imports from
 *     `@rezics/i18n/messages`).
 *  3. Identify the variable holding `useMessage(...)` (typically `m`).
 *  4. Replace `<var>.<key>(...)` with `t('<ns>:<newkey>', ...)` using
 *     `tool/scripts/i18n/key-map.json`.
 *  5. Replace `const <var> = useMessage(<arg>)` with
 *     `const { t } = useTranslation([<ns-list>])`.
 *  6. Strip the `@rezics/i18n/messages` import.
 *  7. Replace `useMessage` import with `useTranslation`.
 *  8. Drop now-dead `const i18nMessages = { ... }` and the inline `{ key }`
 *     argument that only existed for `useMessage`.
 *  9. Insert/merge an `import { useTranslation } from "@rezics/i18n/react"`.
 *
 * Run with `bun run tool/scripts/i18n/codemod-paraglide-to-i18next.ts`.
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO_ROOT = new URL("../../..", import.meta.url).pathname;
const KEY_MAP_PATH = join(REPO_ROOT, "tool/scripts/i18n/key-map.json");
const SCAN_ROOTS = [
  "package/app/src",
  "package/admin/src",
  "package/ui/src",
  "package/editor/src",
  "package/folio/src",
];

type KeyMap = Record<string, string>;
type Report = {
  filesScanned: number;
  filesModified: number;
  unknownKeys: { file: string; key: string }[];
  dynamicAccess: { file: string; line: number; snippet: string }[];
  removedMessagesImports: number;
  rewrittenUseMessage: number;
  rewrittenCalls: number;
};

const TARGET_EXT = /\.(tsx?|jsx?)$/;
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".storybook",
  "paraglide",
]);

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

/**
 * Find namespace+newkey for a legacy flat key. Falls back to null if the key
 * is unknown (caller should flag).
 */
function lookup(keyMap: KeyMap, flatKey: string): { ns: string; key: string } | null {
  const target = keyMap[flatKey];
  if (!target) return null;
  const idx = target.indexOf(":");
  if (idx < 0) return null;
  return { ns: target.slice(0, idx), key: target.slice(idx + 1) };
}

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Process a single file's content. Returns the new content (or null if no
 * changes), plus per-file diagnostics.
 */
function transformFile(
  path: string,
  source: string,
  keyMap: KeyMap,
  report: Report,
): string | null {
  let next = source;
  let changed = false;

  // Quick filter — does the file mention i18n at all?
  if (
    !next.includes("@rezics/i18n") &&
    !/\buseMessage\s*\(/.test(next) &&
    !/\bm\./.test(next)
  ) {
    return null;
  }

  // 1. Parse imported flat-key names from `@rezics/i18n/messages`.
  const importedKeys = new Set<string>();
  const messagesImportRe =
    /import\s*\{([^}]+)\}\s*from\s*["']@rezics\/i18n\/messages["'];?\s*\n?/g;
  next = next.replace(messagesImportRe, (_, body: string) => {
    for (const raw of body.split(",")) {
      const name = raw.replace(/\bas\b.*$/, "").trim();
      if (name) importedKeys.add(name);
    }
    report.removedMessagesImports += 1;
    changed = true;
    return "";
  });

  // 2. Collect var bindings for `useMessage(...)` calls.
  //    Captures the LHS variable name and the argument source.
  const useMessageBindings: { varName: string; raw: string; arg: string }[] = [];
  const useMessageRe =
    /(const|let)\s+(\w+)\s*=\s*useMessage\s*\(\s*([^;]+?)\s*\)\s*;?\s*\n?/g;
  next = next.replace(useMessageRe, (raw, _kind, varName: string, arg: string) => {
    useMessageBindings.push({ varName, raw, arg });
    return "__USEMESSAGE_PLACEHOLDER_" + (useMessageBindings.length - 1) + "__\n";
  });

  // 3. For each var binding, find keys referenced via `<var>.<key>(`. Walk
  //    the whole file content; this covers the binding scope adequately for
  //    typical single-component files.
  const callsByVar = new Map<string, Set<string>>();
  for (const { varName } of useMessageBindings) {
    callsByVar.set(varName, new Set());
  }
  // Also support direct `m.<key>(` references when `m` was destructured from
  // `import * as m from "@rezics/i18n/messages"` (legacy direct-call form).
  const wildcardImportRe =
    /import\s*\*\s*as\s*(\w+)\s*from\s*["']@rezics\/i18n\/messages["'];?\s*\n?/g;
  next = next.replace(wildcardImportRe, (_, varName: string) => {
    callsByVar.set(varName, new Set());
    changed = true;
    return "";
  });

  // For each varName, scan all `<varName>.<key>(...)` and flag dynamic access.
  for (const varName of callsByVar.keys()) {
    const dynamicRe = new RegExp(`\\b${varName}\\[`, "g");
    const dynMatches = next.matchAll(dynamicRe);
    for (const m of dynMatches) {
      const lineStart = next.lastIndexOf("\n", m.index!);
      const line = next.slice(lineStart === -1 ? 0 : lineStart + 1, next.indexOf("\n", m.index!));
      report.dynamicAccess.push({
        file: path,
        line: next.slice(0, m.index!).split("\n").length,
        snippet: line.trim().slice(0, 200),
      });
    }
  }

  // Replace `<varName>.<key>(...)` calls.
  for (const varName of callsByVar.keys()) {
    const callRe = new RegExp(`\\b${varName}\\.(\\w+)\\s*\\(`, "g");
    next = next.replace(callRe, (whole, key: string) => {
      const mapped = lookup(keyMap, key);
      if (!mapped) {
        report.unknownKeys.push({ file: path, key });
        return whole;
      }
      callsByVar.get(varName)!.add(key);
      report.rewrittenCalls += 1;
      changed = true;
      return `t("${mapped.ns}:${mapped.key}"`;
    });
    // Handle 0-arg calls without input — they look like `t("ns:key")` already
    // because the regex consumed `(`. The closing `)` is unchanged.
  }

  // Compute namespace set per binding from collected calls.
  function nsFromKeys(keys: Iterable<string>): string[] {
    const set = new Set<string>();
    for (const k of keys) {
      const m = lookup(keyMap, k);
      if (m) set.add(m.ns);
    }
    return Array.from(set).sort();
  }

  // 4. Replace placeholders with `const { t } = useTranslation([...])`.
  for (let i = 0; i < useMessageBindings.length; i += 1) {
    const { varName } = useMessageBindings[i];
    const placeholder = "__USEMESSAGE_PLACEHOLDER_" + i + "__\n";
    const namespaces = nsFromKeys(callsByVar.get(varName) ?? []);
    const nsLit = namespaces.length > 0
      ? `[${namespaces.map((n) => `"${n}"`).join(", ")}]`
      : `"common"`;
    next = next.replace(
      placeholder,
      `const { t } = useTranslation(${nsLit});\n`,
    );
    report.rewrittenUseMessage += 1;
    changed = true;
  }

  // 5. Strip the `useMessage` import and add `useTranslation`. Merge with an
  //    existing `@rezics/i18n/react` import if present.
  const reactImportRe =
    /import\s*\{([^}]+)\}\s*from\s*["']@rezics\/i18n\/react["'];?\s*\n?/g;
  let hasReactImport = false;
  next = next.replace(reactImportRe, (_, body: string) => {
    hasReactImport = true;
    const names = new Set(
      body
        .split(",")
        .map((s) => s.replace(/\bas\b.*$/, "").trim())
        .filter(Boolean),
    );
    names.delete("useMessage");
    names.delete("ReactiveMessageBag");
    names.add("useTranslation");
    changed = true;
    return `import { ${Array.from(names).sort().join(", ")} } from "@rezics/i18n/react";\n`;
  });
  if (!hasReactImport && (useMessageBindings.length > 0 || callsByVar.size > 0)) {
    // Insert a fresh import at the top, after the last existing import.
    const lastImportEnd = (() => {
      const re = /^import[^\n]*\n/gm;
      let last = 0;
      for (const m of next.matchAll(re)) {
        last = m.index! + m[0].length;
      }
      return last;
    })();
    next =
      next.slice(0, lastImportEnd) +
      `import { useTranslation } from "@rezics/i18n/react";\n` +
      next.slice(lastImportEnd);
    changed = true;
  }

  // 6. Drop now-dead `const <name> = { key1, key2, ... }` blocks when every
  //    inner key matches an imported message key. This is conservative — we
  //    only drop blocks whose entries are all shorthand-property identifiers
  //    that match `importedKeys`.
  if (importedKeys.size > 0) {
    const constObjRe =
      /(?:^|\n)(?:const|let)\s+\w+\s*=\s*\{([^{}]*)\}\s*;\s*\n/g;
    next = next.replace(constObjRe, (whole, body: string) => {
      const trimmed = body.trim();
      if (!trimmed) return whole;
      const entries = trimmed.split(",").map((e) => e.trim()).filter(Boolean);
      const allImported = entries.every((e) => {
        const ident = e.replace(/:.*$/, "").trim();
        return importedKeys.has(ident);
      });
      if (!allImported) return whole;
      changed = true;
      return "\n";
    });
  }

  return changed ? next : null;
}

async function main(): Promise<void> {
  const keyMap = JSON.parse(await readFile(KEY_MAP_PATH, "utf8")) as KeyMap;
  const report: Report = {
    filesScanned: 0,
    filesModified: 0,
    unknownKeys: [],
    dynamicAccess: [],
    removedMessagesImports: 0,
    rewrittenUseMessage: 0,
    rewrittenCalls: 0,
  };

  for (const rel of SCAN_ROOTS) {
    const files = await walk(join(REPO_ROOT, rel));
    for (const file of files) {
      report.filesScanned += 1;
      const source = await readFile(file, "utf8");
      const next = transformFile(file, source, keyMap, report);
      if (next != null) {
        await writeFile(file, next, "utf8");
        report.filesModified += 1;
      }
    }
  }

  console.log(
    `codemod: scanned=${report.filesScanned} modified=${report.filesModified} ` +
      `imports_removed=${report.removedMessagesImports} ` +
      `useMessage_rewritten=${report.rewrittenUseMessage} ` +
      `calls_rewritten=${report.rewrittenCalls} ` +
      `unknown_keys=${report.unknownKeys.length} ` +
      `dynamic_access=${report.dynamicAccess.length}`,
  );

  if (report.unknownKeys.length) {
    console.log("\nUnknown keys (first 20):");
    for (const u of report.unknownKeys.slice(0, 20)) {
      console.log(`  ${u.file}: ${u.key}`);
    }
  }
  if (report.dynamicAccess.length) {
    console.log("\nDynamic access sites (first 20):");
    for (const d of report.dynamicAccess.slice(0, 20)) {
      console.log(`  ${d.file}:${d.line}: ${d.snippet}`);
    }
  }

  if (report.dynamicAccess.length > 0) {
    process.exitCode = 2;
  }
}

if (import.meta.main) {
  await main();
}
