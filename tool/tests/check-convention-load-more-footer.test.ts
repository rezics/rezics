import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

function collectTsxFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry.includes(".gen.")) continue;
    if (statSync(full).isDirectory()) {
      collectTsxFiles(full, acc);
    } else if (
      full.endsWith(".tsx") &&
      !entry.includes(".test.") &&
      !entry.includes(".stories.")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

// Detects inline load-more button patterns that should use LoadMoreFooter.
// 检测应使用 LoadMoreFooter 的内联 load-more 按钮模式。
const INLINE_LOAD_MORE_PATTERN =
  /isFetchingNextPage[\s\S]{0,80}common:load(?:ing|_more)/;

// Detects inline IntersectionObserver for infinite scroll (fetchNextPage nearby).
// 检测用于无限滚动的内联 IntersectionObserver（附近有 fetchNextPage）。
const INLINE_IO_SCROLL_PATTERN =
  /IntersectionObserver[\s\S]{0,200}fetchNextPage|fetchNextPage[\s\S]{0,200}IntersectionObserver/;

describe("LoadMoreFooter convergence", () => {
  const appSrc = join(import.meta.dir, "../../package/app/src");
  const allTsx = collectTsxFiles(appSrc);

  test("LoadMoreFooter.tsx exists", () => {
    const exists = allTsx.some((f) => f.includes("LoadMoreFooter.tsx"));
    expect(exists).toBe(true);
  });

  test("no inline IntersectionObserver for infinite scroll", () => {
    const violations: string[] = [];
    for (const file of allTsx) {
      if (file.includes("LoadMoreFooter.tsx")) continue;
      const content = readFileSync(file, "utf-8");
      if (INLINE_IO_SCROLL_PATTERN.test(content)) {
        violations.push(file.replace(appSrc, ""));
      }
    }
    expect(violations).toEqual([]);
  });

  test("no page/section duplicates the inline load-more button pattern", () => {
    const violations: string[] = [];
    for (const file of allTsx) {
      if (file.includes("LoadMoreFooter.tsx")) continue;
      const content = readFileSync(file, "utf-8");
      if (INLINE_LOAD_MORE_PATTERN.test(content)) {
        violations.push(file.replace(appSrc, ""));
      }
    }
    expect(violations).toEqual([]);
  });
});
