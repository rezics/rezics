/**
 * Convention test: QueryBoundary anti-regression guard.
 * Ensures migrated sections use QueryBoundary instead of hand-rolled
 * plain-text loading patterns.
 *
 * 约定测试：QueryBoundary 防回归守卫。
 * 确保已迁移的 section 使用 QueryBoundary，而非手写的纯文本加载模式。
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// import.meta.dir is package/app/src/core/components
// 导航到 package/app/src
const APP_SRC = join(import.meta.dir, "../..");

/**
 * These are the source files that must NOT contain the hand-rolled
 * plain-text loading pattern:
 *   <p ...>{t("common:loading")}</p>
 *   <p ...>{t("common:loading")}</p>
 * or the inline-spinner variant used before QueryBoundary was introduced.
 *
 * 这些源文件不应再包含手写的纯文本加载模式。
 */
const MIGRATED_FILES: Array<{ path: string; label: string }> = [
  {
    path: join(APP_SRC, "user/sections/FollowersTabSection.tsx"),
    label: "FollowersTabSection",
  },
  {
    path: join(APP_SRC, "user/sections/ShelvesTabSection.tsx"),
    label: "ShelvesTabSection",
  },
  {
    path: join(APP_SRC, "user/sections/ContentTabSection.tsx"),
    label: "ContentTabSection",
  },
  {
    path: join(APP_SRC, "user/sections/ShelfContentsSearchSection.tsx"),
    label: "ShelfContentsSearchSection",
  },
  {
    path: join(APP_SRC, "inbox/pages/NotificationPage.tsx"),
    label: "NotificationPage",
  },
  {
    path: join(APP_SRC, "inbox/sections/ConversationListSection.tsx"),
    label: "ConversationListSection",
  },
  {
    path: join(APP_SRC, "realm/components/RealmMemberList.tsx"),
    label: "RealmMemberList",
  },
  {
    path: join(APP_SRC, "draft/pages/DraftsPage.tsx"),
    label: "DraftsPage",
  },
];

/**
 * Patterns that indicate a hand-rolled plain-text loading state.
 * Any of these in a migrated file is a violation.
 *
 * 表示手写纯文本加载状态的模式。迁移后的文件中出现任何这些模式均为违规。
 */
const FORBIDDEN_LOADING_PATTERNS = [
  // <p ...>{t("common:loading")}</p>  (plain text paragraph loading)
  /\{t\(["']common:loading["']\)\}/,
];

describe("QueryBoundary convention", () => {
  test("QueryBoundary component file exists", () => {
    const content = readFileSync(
      join(APP_SRC, "core/components/QueryBoundary.tsx"),
      "utf8",
    );
    expect(content).toContain("QueryBoundary");
  });

  test("migrated sections do not hand-roll plain-text loading pattern", () => {
    const violations: string[] = [];

    for (const { path, label } of MIGRATED_FILES) {
      const source = readFileSync(path, "utf8");
      for (const pattern of FORBIDDEN_LOADING_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(
            `${label}: still contains hand-rolled loading pattern`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("migrated sections import QueryBoundary", () => {
    const violations: string[] = [];

    for (const { path, label } of MIGRATED_FILES) {
      const source = readFileSync(path, "utf8");
      if (!source.includes("QueryBoundary")) {
        violations.push(`${label}: does not import or use QueryBoundary`);
      }
    }

    expect(violations).toEqual([]);
  });
});
