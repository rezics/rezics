/**
 * Convention test: tag feature must not use `(error as any)` casts.
 * All error display should go through QueryBoundary or QueryErrorDisplay.
 *
 * 约定测试：tag 功能不得使用 `(error as any)` 类型转换。
 * 所有错误展示应通过 QueryBoundary 或 QueryErrorDisplay 统一处理。
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const TAG_DIR = join(import.meta.dir, "../../package/app/src/tag");

/** Recursively collect all .tsx/.ts files under a directory. */
// 递归收集目录下所有 .tsx/.ts 文件
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

describe("tag error display convention", () => {
  test("no (error as any) casts in package/app/src/tag/", () => {
    const files = collectFiles(TAG_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("(error as any)")) {
          const relative = file.replace(`${TAG_DIR}/`, "");
          violations.push(`${relative}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
