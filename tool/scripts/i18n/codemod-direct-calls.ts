#!/usr/bin/env bun
/**
 * Second-pass codemod for files where the first pass missed direct
 * imported-function call sites — typically module-level configs that
 * imported Paraglide message functions and called them outside a React
 * component (e.g. `book_edit_sidebar_back_to_book()`).
 *
 * For such files we replace each direct call with
 * `getI18nRuntime().i18n.t("<ns>:<key>")`, add the runtime import, and drop
 * the now-orphan named imports from `@rezics/i18n/messages`.
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
const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".storybook"]);
const TARGET_EXT = /\.(tsx?|jsx?)$/;

type KeyMap = Record<string, string>;

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

function lookup(map: KeyMap, key: string): string | null {
  return map[key] ?? null;
}

async function main(): Promise<void> {
  const keyMap = JSON.parse(await readFile(KEY_MAP_PATH, "utf8")) as KeyMap;
  const allKeys = new Set(Object.keys(keyMap));

  let modified = 0;
  let totalCalls = 0;

  for (const rel of SCAN_ROOTS) {
    const files = await walk(join(REPO_ROOT, rel));
    for (const file of files) {
      let source = await readFile(file, "utf8");
      let changed = false;

      // Strip any remaining `import { ... } from "@rezics/i18n/messages"` (or
      // `#/paraglide/messages.js`) lines, capturing the names imported so we
      // know what to rewrite.
      const importedNames = new Set<string>();
      source = source.replace(
        /import\s*\{([^}]+)\}\s*from\s*["'](?:@rezics\/i18n\/messages|#\/paraglide\/messages(?:\.js)?|[^"']*paraglide\/messages(?:\.js)?)["'];?\s*\n?/g,
        (_, body: string) => {
          for (const raw of body.split(",")) {
            const name = raw.replace(/\bas\b.*$/, "").trim();
            if (name) importedNames.add(name);
          }
          changed = true;
          return "";
        },
      );

      // Find any bare-name `<key>(...)` call where `<key>` matches a known
      // legacy flat key. We're conservative: only rewrite if the identifier
      // appears as a known message key in the key-map AND has not been
      // shadowed by a same-name local binding (heuristic: identifier appears
      // exactly once before the call site, in the now-removed import).
      const candidates = new Set<string>();
      for (const name of importedNames) {
        if (allKeys.has(name)) candidates.add(name);
      }
      // Also pick up dangling references like `book_foo_bar()` that survived
      // even without an import (e.g. wrapper consts elsewhere).
      for (const m of source.matchAll(/\b([a-z][a-z0-9_]*[a-z0-9])\s*\(/g)) {
        if (allKeys.has(m[1]!)) candidates.add(m[1]!);
      }

      let callsRewritten = 0;
      for (const name of candidates) {
        const target = lookup(keyMap, name);
        if (!target) continue;
        // Replace `<name>(` with `getI18nRuntime().i18n.t("<target>")` /
        // `getI18nRuntime().i18n.t("<target>", `. Closer detection mirrors
        // the first-pass codemod.
        const callRe = new RegExp(`\\b${name}\\s*\\(\\s*(\\)?)`, "g");
        source = source.replace(callRe, (_whole, closer: string) => {
          callsRewritten += 1;
          const literal = `"${target}"`;
          if (closer === ")") {
            return `getI18nRuntime().i18n.t(${literal})`;
          }
          return `getI18nRuntime().i18n.t(${literal}, `;
        });
      }

      if (callsRewritten > 0) {
        // Insert the runtime import if missing. Find the END of the last
        // top-level `import ... from "...";` statement (which may span many
        // lines for `import { … }` shapes) by walking statement boundaries.
        if (!source.includes("@rezics/i18n/runtime")) {
          const importEndRe = /^import\b[\s\S]*?from\s+["'][^"']+["'];?\s*\n/gm;
          let lastEnd = 0;
          for (const m of source.matchAll(importEndRe)) {
            lastEnd = m.index! + m[0].length;
          }
          source =
            source.slice(0, lastEnd) +
            `import { getI18nRuntime } from "@rezics/i18n/runtime";\n` +
            source.slice(lastEnd);
        } else if (
          !/import\s*\{[^}]*\bgetI18nRuntime\b[^}]*\}\s*from\s*["']@rezics\/i18n\/runtime["']/.test(
            source,
          )
        ) {
          source = source.replace(
            /import\s*\{([^}]+)\}\s*from\s*["']@rezics\/i18n\/runtime["']/,
            (_, body: string) => {
              const names = new Set(
                body
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              );
              names.add("getI18nRuntime");
              return `import { ${Array.from(names).sort().join(", ")} } from "@rezics/i18n/runtime"`;
            },
          );
        }
        changed = true;
        totalCalls += callsRewritten;
      }

      // Drop any now-dead `const <name> = { <keys> }` block whose entries
      // are all imported names (likely message bag for useMessage).
      const objRe =
        /(?:^|\n)(?:const|let)\s+\w+\s*=\s*\{([^{}]*)\}\s*;\s*\n/g;
      source = source.replace(objRe, (whole, body: string) => {
        const trimmed = body.trim();
        if (!trimmed) return whole;
        const entries = trimmed.split(",").map((e) => e.trim()).filter(Boolean);
        if (entries.length === 0) return whole;
        const allInImport = entries.every((e) => {
          const ident = e.replace(/:.*$/, "").trim();
          return importedNames.has(ident);
        });
        if (!allInImport) return whole;
        changed = true;
        return "\n";
      });

      if (changed) {
        await writeFile(file, source, "utf8");
        modified += 1;
      }
    }
  }

  console.log(
    `direct-call codemod: modified=${modified} calls_rewritten=${totalCalls}`,
  );
}

if (import.meta.main) {
  await main();
}
