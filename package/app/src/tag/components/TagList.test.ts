/**
 * Convention: event handlers must accept the correct event types, not cast
 * via as unknown as.
 * 约定：事件处理器必须接受正确的事件类型，不得通过 as unknown as 强制转换。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const src = readFileSync(join(import.meta.dir, "TagList.tsx"), "utf-8");

describe("TagList event type safety", () => {
  test("no as unknown as casts", () => {
    expect(src).not.toContain("as unknown as");
  });

  test("handleClick accepts keyboard events", () => {
    expect(src).toContain("React.MouseEvent | React.KeyboardEvent");
  });
});
