import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

// Per-mutation `onError: (e) => toast.error(e.message)` bypasses the global
// MutationCache.onError handler (which shows translated generic errors) and
// shows raw untranslated strings. Grep for violations instead of globbing.
// 逐 mutation `onError: (e) => toast.error(e.message)` 绕过全局 MutationCache.onError
// handler（显示翻译后的通用错误），并显示原始未翻译字符串。用 grep 检测违规。
const appSrc = join(import.meta.dir, "../../package/app/src");

describe("no raw onError toast.error bypass", () => {
  test("no mutation callsite uses raw toast.error(error.message) as onError", () => {
    const raw = execSync(
      `grep -rn "onError.*toast\\.error" "${appSrc}" --include="*.tsx" --include="*.ts" || true`,
      { encoding: "utf-8" },
    );
    const violations = raw
      .split("\n")
      .filter((l) => l.trim())
      .filter((l) => !l.includes(".test.") && !l.includes(".stories."))
      .map((l) => l.replace(appSrc + "/", ""));
    expect(violations).toEqual([]);
  });
});
