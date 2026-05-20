import { describe, expect, test } from "bun:test";
import {
  compareRevisionSlots,
  createInlineTokenDiff,
  createMarkdownLineDiff,
} from "./historyCompare";

describe("history compare utilities", () => {
  test("renders English Markdown source line and inline changes", () => {
    const lineParts = createMarkdownLineDiff(
      "# Title\n\nOld paragraph\n",
      "# Title\n\nNew paragraph\n\n- added\n",
    );

    expect(lineParts.some((part) => part.type === "removed")).toBe(true);
    expect(lineParts.some((part) => part.type === "added")).toBe(true);

    const result = compareRevisionSlots(
      {
        translations: [
          {
            language: "en",
            description: "A quiet opening.",
          },
        ],
      },
      {
        translations: [
          {
            language: "en",
            description: "A brighter opening.",
          },
        ],
      },
    );

    expect(result.changes[0]).toMatchObject({
      kind: "markdown",
      path: "translations.en.description",
    });
  });

  test("creates CJK-aware inline token diff with safe output", () => {
    const parts = createInlineTokenDiff(
      "旧世界正在醒来",
      "新世界正在醒来",
      "zh",
    );

    expect(parts.map((part) => part.value).join("")).toContain("世界正在醒来");
    expect(parts.some((part) => part.type === "removed")).toBe(true);
    expect(parts.some((part) => part.type === "added")).toBe(true);
  });

  test("compares scalar extension fields and hides unchanged fields", () => {
    const result = compareRevisionSlots(
      { extension: { book: { pageCount: 200 }, ignored: "same" } },
      { extension: { book: { pageCount: 220 }, ignored: "same" } },
    );

    expect(result.changes).toEqual([
      {
        kind: "scalar",
        path: "extension.book.pageCount",
        before: 200,
        after: 220,
      },
    ]);
  });

  test("compares added and removed semantic collection items", () => {
    const result = compareRevisionSlots(
      { tags: [{ tagUnitId: "tag-old" }] },
      { tags: [{ tagUnitId: "tag-new" }] },
    );

    expect(result.changes).toEqual([
      {
        kind: "collection",
        path: "tags",
        added: [{ tagUnitId: "tag-new" }],
        removed: [{ tagUnitId: "tag-old" }],
        updated: [],
      },
    ]);
  });

  test("compares updated credits by semantic identity", () => {
    const result = compareRevisionSlots(
      { credits: [{ entityId: "entity-1", role: "author", order: 1 }] },
      { credits: [{ entityId: "entity-1", role: "editor", order: 1 }] },
    );

    expect(result.changes).toEqual([
      {
        kind: "collection",
        path: "credits",
        added: [],
        removed: [],
        updated: [
          {
            key: "entity-1",
            before: { entityId: "entity-1", role: "author", order: 1 },
            after: { entityId: "entity-1", role: "editor", order: 1 },
          },
        ],
      },
    ]);
  });

  test("uses raw JSON fallback for unknown slots when authorized", () => {
    const result = compareRevisionSlots(
      { unknownSlot: { a: 1 } },
      { unknownSlot: { a: 2 } },
      { allowRaw: true },
    );

    expect(result.changes[0]).toMatchObject({
      kind: "raw",
      path: "unknownSlot",
      before: { a: 1 },
      after: { a: 2 },
      hidden: false,
    });
  });

  test("omits unchanged fields", () => {
    expect(
      compareRevisionSlots(
        { translations: [{ language: "ja", title: "同じ" }] },
        { translations: [{ language: "ja", title: "同じ" }] },
      ).changes,
    ).toEqual([]);
  });
});
