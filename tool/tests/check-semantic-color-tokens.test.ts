import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

// Semantic color tokens must resolve to valid UnoCSS utilities. The top-level
// `error`, `success`, `warning`, `info` groups in `colors.ts` provide the
// shorthand convention (`text-error-text`, `bg-success-fill`, etc.). The
// prefix-swapped typo `text-text-error` is never valid.
// 语义色 token 必须能解析为有效的 UnoCSS 工具类。colors.ts 中顶层的
// error/success/warning/info 组提供简写约定。前缀颠倒的拼写错误
// `text-text-error` 永远无效。

const SCAN_ROOTS = [
  join(import.meta.dir, "../../package/app/src"),
  join(import.meta.dir, "../../package/admin/src"),
  join(import.meta.dir, "../../package/ui/src"),
];

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

// `text-text-{semantic}` is a known typo: the `text` group has no `error`,
// `success`, `warning`, or `info` key. The correct form drops the first
// `text-`: `text-error-text`, `text-success-text`, etc.
// `text-text-{semantic}` 是已知拼写错误：`text` 组没有 error/success/
// warning/info 键。正确形式去掉第一个 `text-`。
const TYPO_PATTERN =
  /\btext-text-(?:error|success|warning|info)\b/;

describe("semantic color token validity", () => {
  test("no text-text-{semantic} typo in source files", () => {
    const violations: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walk(root)) {
        const content = readFileSync(file, "utf-8");
        if (TYPO_PATTERN.test(content)) {
          violations.push(relative(join(import.meta.dir, "../.."), file));
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
