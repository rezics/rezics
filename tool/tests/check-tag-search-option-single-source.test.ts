import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

// tagSearchOptionFromDoc / SearchTagOption must only be declared in the
// canonical module; consumers import from @/tag/models/tagSearchOption.
// tagSearchOptionFromDoc / SearchTagOption 只能在规范模块中声明；
// 消费者从 @/tag/models/tagSearchOption 导入。

const appSrc = join(import.meta.dir, "../../package/app/src");
const CANONICAL = "tag/models/tagSearchOption.ts";

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

describe("tagSearchOption single source of truth", () => {
  test("no file outside canonical module declares tagSearchOptionFromDoc or type SearchTagOption", () => {
    const violations: string[] = [];
    const pattern = /(?:function\s+tagSearchOptionFromDoc|type\s+SearchTagOption\s*=)/;
    for (const file of walk(appSrc)) {
      const rel = relative(appSrc, file);
      if (rel === CANONICAL || rel.endsWith(".test.ts")) continue;
      const content = readFileSync(file, "utf-8");
      if (pattern.test(content)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
