import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { REPO_ROOT } from "../src/commands/convention/core/paths";

const APP_SRC = join(REPO_ROOT, "package/app/src");

describe("paginator sort props convention", () => {
  // No consumer should cast sort props with `undefined as any`.
  // 消费方不应通过 `undefined as any` 强制转换排序属性。
  test("no `undefined as any` casts for sort props in app source", () => {
    let output = "";
    try {
      output = execSync(
        `grep -rn 'sortType={undefined as any}\\|sortOrder={undefined as any}' "${APP_SRC}" || true`,
        { encoding: "utf-8" },
      );
    } catch {
      // grep exits 1 when no matches — that is the passing case.
      // grep 无匹配时返回 1——这正是通过的情况。
    }
    const hits = output.trim();
    expect(hits).toBe("");
  });
});
