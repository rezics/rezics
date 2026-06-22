import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

// languageLabel must be imported from @rezics/contract; local copies are
// banned. clampStyle must be imported from shared/utils/css-util.
// languageLabel 必须从 @rezics/contract 导入；禁止本地副本。
// clampStyle 必须从 shared/utils/css-util 导入。

const appSrc = join(import.meta.dir, "../../package/app/src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".git") continue;
      out.push(...walk(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("duplicated utility single source", () => {
  test("no app file inlines the languageLabel(code) 'nativeName (code)' pattern", () => {
    const violations: string[] = [];
    // The A-variant fingerprint: casts LANGUAGE_META to a Record and
    // formats as "nativeName (code)". Two simpler B-variant files that
    // return only nativeName are intentionally excluded.
    // A 变体指纹：将 LANGUAGE_META 强转为 Record 并格式化为
    // "nativeName (code)"。两个只返回 nativeName 的 B 变体文件被排除。
    const pattern = /LANGUAGE_META\s+as\s+Record<string,\s*\{\s*nativeName/;
    for (const file of walk(appSrc)) {
      const rel = relative(appSrc, file);
      if (rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
      if (pattern.test(readFileSync(file, "utf-8"))) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  test("no app file outside css-util defines clampStyle", () => {
    const violations: string[] = [];
    const canonical = "shared/utils/css-util.ts";
    const pattern = /function\s+clampStyle\b/;
    for (const file of walk(appSrc)) {
      const rel = relative(appSrc, file);
      if (rel === canonical || rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
      if (pattern.test(readFileSync(file, "utf-8"))) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
