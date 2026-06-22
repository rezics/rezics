/**
 * Convention test: critical rendering/routing/dispatch switches on typed
 * discriminated unions must use a `default: { const _exhaustive: never = ... }`
 * guard so TypeScript catches missing variants at compile time.
 *
 * 约定测试：关键的渲染/路由/分发 switch（基于有类型的判别联合）必须使用
 * `default: { const _exhaustive: never = ... }` 守卫，以便 TypeScript 在编
 * 译期捕获缺失的变体。
 */

import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");

// Files that must contain the exhaustive guard pattern.
// 必须包含穷尽守卫模式的文件。
const REQUIRED_FILES = [
  // --- app rendering / routing ---
  "package/app/src/zone/components/sections/ZoneContentSections.tsx",
  "package/app/src/draft/components/DraftList.tsx",
  "package/app/src/feedback/components/FeedbackList.tsx",
  "package/app/src/progress/models/resumeRoute.ts",
  "package/app/src/engagement/hooks/useVoteController.ts",
  "package/app/src/realm/models/realmDetailRoutes.ts",
  // --- server ---
  "package/server/src/stream/stream.service.ts",
  "package/server/src/draft/draft.mapper.ts",
  "package/server/src/zone/zone.service.ts",
];

const EXHAUSTIVE_PATTERN = /const\s+_exhaustive:\s*never\s*=/;

describe("exhaustive switch guards", () => {
  test("critical union switches contain `const _exhaustive: never =`", () => {
    const missing: string[] = [];
    for (const rel of REQUIRED_FILES) {
      const content = readFileSync(resolve(ROOT, rel), "utf-8");
      if (!EXHAUSTIVE_PATTERN.test(content)) {
        missing.push(rel);
      }
    }
    expect(missing).toEqual([]);
  });
});
