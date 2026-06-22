/**
 * Convention: Excerpt components must not cast UnitDTO to access runtime fields.
 * 约定：Excerpt 组件不得通过类型转换来访问运行时字段。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const detailSrc = readFileSync(
  join(import.meta.dir, "detail/ExcerptDetail.tsx"),
  "utf-8",
);
const cardSrc = readFileSync(
  join(import.meta.dir, "item/ExcerptCard.tsx"),
  "utf-8",
);

describe("excerpt component type safety", () => {
  test("ExcerptDetail: no as unknown as casts", () => {
    expect(detailSrc).not.toContain("as unknown as");
  });

  test("ExcerptCard: no as unknown as casts", () => {
    expect(cardSrc).not.toContain("as unknown as");
  });
});
