import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

// Production code must use design tokens (text-text-secondary, bg-surface-*,
// border-border, etc.) instead of raw Tailwind color scales (gray-*, slate-*,
// etc.). Raw scales don't adapt to dark mode and bypass the token system.
// 生产代码必须使用设计 token（text-text-secondary、bg-surface-* 等）而非原始
// Tailwind 色阶（gray-*、slate-* 等）。原始色阶不适配暗色模式且绕过 token 体系。

const SCAN_ROOTS = [
  join(import.meta.dir, "../../package/app/src"),
  join(import.meta.dir, "../../package/ui/src"),
];

const SKIP_DIRS = new Set(["node_modules", ".git", "playground"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (
      (full.endsWith(".ts") || full.endsWith(".tsx")) &&
      !full.endsWith(".stories.tsx") &&
      !full.endsWith(".stories.ts") &&
      !full.endsWith(".test.tsx") &&
      !full.endsWith(".test.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

// Match raw Tailwind color-scale classes: text-gray-500, bg-slate-100, etc.
// Captures the common gray/slate/zinc/neutral/stone palettes.
// 匹配原始 Tailwind 色阶类名：text-gray-500、bg-slate-100 等。
const RAW_COLOR_PATTERN =
  /\b(?:text|bg|border|ring|outline|decoration|shadow|divide|from|to|via)-(?:gray|slate|zinc|neutral|stone)-\d{2,3}\b/;

// Dead sections that haven't been cleaned up yet — exclude from the check.
// 尚未清理的死代码区——排除检查。
const KNOWN_DEAD = new Set([
  "home/sections/HomeRankingSection.tsx",
  "home/sections/HomeAuthorSpotlight.tsx",
  "home/components/HomeMobileDownloadCTA.tsx",
  "composite/layouts/CustomSidebar.tsx",
]);

describe("no raw Tailwind color scales in production code", () => {
  test("all color references use design tokens, not raw palettes", () => {
    const violations: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walk(root)) {
        const rel = relative(join(import.meta.dir, "../.."), file);
        const shortRel = relative(root, file);
        if (KNOWN_DEAD.has(shortRel)) continue;
        const content = readFileSync(file, "utf-8");
        if (RAW_COLOR_PATTERN.test(content)) {
          violations.push(rel);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
