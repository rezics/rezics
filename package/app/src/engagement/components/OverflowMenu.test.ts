/**
 * Convention: OverflowMenu must not use unsafe casts for event bridging.
 * 约定：OverflowMenu 不得使用不安全的类型转换来桥接事件类型。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const src = readFileSync(join(import.meta.dir, "OverflowMenu.tsx"), "utf-8");

describe("OverflowMenu type safety", () => {
  test("no as unknown as casts", () => {
    expect(src).not.toContain("as unknown as");
  });

  test("no handleSelect indirection (onInvoke called directly)", () => {
    expect(src).not.toContain("handleSelect");
  });
});
