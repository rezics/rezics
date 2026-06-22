import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

// The shared picker row className must only live in the canonical PickerRow
// component; consumers import from @/shared/ui/PickerRow.
// 共享的 picker 行 className 只能在规范 PickerRow 组件中定义；
// 消费者从 @/shared/ui/PickerRow 导入。

const appSrc = join(import.meta.dir, "../../package/app/src");
const CANONICAL = "shared/ui/PickerRow.tsx";

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

describe("PickerRow single source of truth", () => {
  test("no file outside canonical module inlines the picker row className", () => {
    const violations: string[] = [];
    // The distinctive class fingerprint — unique to the picker row button.
    // 这些 class 组合指纹仅属于 picker 行按钮。
    const pattern =
      /rounded-sm px-3 py-2 text-left text-sm leading-ui text-text-primary hover:bg-surface-subtle/;
    for (const file of walk(appSrc)) {
      const rel = relative(appSrc, file);
      if (rel === CANONICAL || rel.endsWith(".test.ts") || rel.endsWith(".test.tsx")) continue;
      const content = readFileSync(file, "utf-8");
      if (pattern.test(content)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });
});
