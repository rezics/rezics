import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

// optionalCount and normalizeReadLanguageInput must only be defined in their
// canonical modules; mapper files import from there.
// optionalCount 和 normalizeReadLanguageInput 只能在规范模块中定义；
// mapper 文件从规范模块导入。

const serverSrc = join(import.meta.dir, "../../package/server/src");

const CANONICAL: Record<string, string> = {
  optionalCount: "utils/queryUtils.ts",
  normalizeReadLanguageInput: "unit/language-resolution.ts",
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".git") continue;
      out.push(...walk(full));
    } else if (full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("server mapper utils single source of truth", () => {
  for (const [fn, canonical] of Object.entries(CANONICAL)) {
    test(`no file outside ${canonical} defines ${fn}`, () => {
      const violations: string[] = [];
      const pattern = new RegExp(`function\\s+${fn}\\b`);
      for (const file of walk(serverSrc)) {
        const rel = relative(serverSrc, file);
        if (rel === canonical || rel.endsWith(".test.ts")) continue;
        if (pattern.test(readFileSync(file, "utf-8"))) {
          violations.push(rel);
        }
      }
      expect(violations).toEqual([]);
    });
  }
});
