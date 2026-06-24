import { describe, expect, test } from "bun:test";
import {
  compareRevisionPathSnapshots,
  compareRevisionSlots,
  createInlineTokenDiff,
  createMarkdownLineDiff,
  resolveRevisionComparePair,
} from "./historyCompare";

describe("history compare utilities", () => {
  test("renders English Markdown source line and inline changes", () => {
    const lineParts = createMarkdownLineDiff(
      "# Title\n\nOld paragraph\n",
      "# Title\n\nNew paragraph\n\n- added\n",
    );

    expect(lineParts.some((part) => part.type === "removed")).toBe(true);
    expect(lineParts.some((part) => part.type === "added")).toBe(true);

    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 2,
      candidatePaths: ["translations.en.description"],
      changes: [
        {
          path: "translations.en.description",
          base: { value: "A quiet opening.", sequence: 1 },
          target: { value: "A brighter opening.", sequence: 2 },
        },
      ],
    });

    expect(result.changes[0]).toMatchObject({
      kind: "markdown",
      path: "translations.en.description",
    });
  });

  test("path snapshot compare renders nested description source as markdown with full path", () => {
    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 2,
      candidatePaths: ["translations.en.description.main.source"],
      changes: [
        {
          path: "translations.en.description.main.source",
          base: { value: "Opening line\nOld detail\n", sequence: 1 },
          target: {
            value: "Opening line\nNew detail\n\n- added beat\n",
            sequence: 2,
          },
        },
      ],
    });

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      kind: "markdown",
      path: "translations.en.description.main.source",
      before: "Opening line\nOld detail\n",
      after: "Opening line\nNew detail\n\n- added beat\n",
    });

    const change = result.changes[0];
    expect(change?.path).not.toBe("translations.en.description");
    expect(change?.kind).not.toBe("scalar");
    if (change?.kind !== "markdown") {
      throw new Error("expected nested source change to render as markdown");
    }
    expect(change.lineParts.some((part) => part.type === "removed")).toBe(true);
    expect(change.lineParts.some((part) => part.type === "added")).toBe(true);
  });

  test("path snapshot compare keeps multiple rich source leaves separate", () => {
    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 2,
      candidatePaths: [
        "translations.en.description.main.source",
        "translations.en.description.slots.cast.title.source",
      ],
      changes: [
        {
          path: "translations.en.description.main.source",
          base: { value: "Main before", sequence: 1 },
          target: { value: "Main after", sequence: 2 },
        },
        {
          path: "translations.en.description.slots.cast.title.source",
          base: { value: "Cast before", sequence: 1 },
          target: { value: "Cast after", sequence: 2 },
        },
      ],
    });

    expect(result.changes).toHaveLength(2);
    expect(result.changes.map((change) => change.path)).toEqual([
      "translations.en.description.main.source",
      "translations.en.description.slots.cast.title.source",
    ]);
    expect(result.changes.every((change) => change.kind === "markdown")).toBe(
      true,
    );
    expect(
      result.changes.some(
        (change) => change.path === "translations.en.description",
      ),
    ).toBe(false);
  });

  test("path snapshot compare renders title-only edits without unchanged translation fields", () => {
    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 2,
      candidatePaths: ["translations.zh-hant.title"],
      changes: [
        {
          path: "translations.zh-hant.title",
          base: { value: "舊標題", sequence: 1 },
          target: { value: "新標題", sequence: 2 },
        },
      ],
    });

    expect(result.changes).toEqual([
      {
        kind: "scalar",
        path: "translations.zh-hant.title",
        before: "舊標題",
        after: "新標題",
      },
    ]);
  });

  test("path snapshot compare keeps non-source strings scalar", () => {
    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 2,
      candidatePaths: [
        "translations.en.title",
        "translations.en.subtitle",
        "unit.slug",
        "extension.book.format",
      ],
      changes: [
        {
          path: "translations.en.title",
          base: { value: "Old title", sequence: 1 },
          target: { value: "New title", sequence: 2 },
        },
        {
          path: "translations.en.subtitle",
          base: { value: "Old subtitle", sequence: 1 },
          target: { value: "New subtitle", sequence: 2 },
        },
        {
          path: "unit.slug",
          base: { value: "old-slug", sequence: 1 },
          target: { value: "new-slug", sequence: 2 },
        },
        {
          path: "extension.book.format",
          base: { value: "paperback", sequence: 1 },
          target: { value: "hardcover", sequence: 2 },
        },
      ],
    });

    expect(result.changes).toEqual([
      {
        kind: "scalar",
        path: "translations.en.title",
        before: "Old title",
        after: "New title",
      },
      {
        kind: "scalar",
        path: "translations.en.subtitle",
        before: "Old subtitle",
        after: "New subtitle",
      },
      {
        kind: "scalar",
        path: "unit.slug",
        before: "old-slug",
        after: "new-slug",
      },
      {
        kind: "scalar",
        path: "extension.book.format",
        before: "paperback",
        after: "hardcover",
      },
    ]);
  });

  test("path snapshot compare renders additive null base values", () => {
    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 3,
      candidatePaths: ["translations.en.summary"],
      changes: [
        {
          path: "translations.en.summary",
          base: { value: null, sequence: null },
          target: { value: "Added", sequence: 2 },
        },
      ],
    });

    expect(result.changes[0]).toMatchObject({
      kind: "scalar",
      path: "translations.en.summary",
      before: null,
      after: "Added",
    });
  });

  test("path snapshot compare keeps non-string source leaves scalar", () => {
    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 2,
      candidatePaths: ["translations.en.description.main.source"],
      changes: [
        {
          path: "translations.en.description.main.source",
          base: { value: null, sequence: null },
          target: { value: "Added source", sequence: 2 },
        },
      ],
    });

    expect(result.changes).toEqual([
      {
        kind: "scalar",
        path: "translations.en.description.main.source",
        before: null,
        after: "Added source",
      },
    ]);
  });

  test("path snapshot compare hides unknown object values without raw access", () => {
    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 2,
      candidatePaths: ["translations.en.description.metadata"],
      changes: [
        {
          path: "translations.en.description.metadata",
          base: { value: { internalNote: "old" }, sequence: 1 },
          target: { value: { internalNote: "new" }, sequence: 2 },
        },
      ],
    });

    expect(result.changes).toEqual([
      {
        kind: "raw",
        path: "translations.en.description.metadata",
        before: undefined,
        after: undefined,
        rawParts: undefined,
        hidden: true,
      },
    ]);
  });

  test("path snapshot compare changed paths are independent of display layout", () => {
    const response = {
      unitId: "book-1",
      baseSequence: 1,
      targetSequence: 2,
      candidatePaths: [
        "translations.en.description.main.source",
        "translations.en.title",
      ],
      changes: [
        {
          path: "translations.en.description.main.source",
          base: { value: "Old source", sequence: 1 },
          target: { value: "New source", sequence: 2 },
        },
        {
          path: "translations.en.title",
          base: { value: "Old title", sequence: 1 },
          target: { value: "New title", sequence: 2 },
        },
      ],
    };

    const pathsByMode = (["unified", "split"] as const).map(() =>
      compareRevisionPathSnapshots(response).changes.map(
        (change) => change.path,
      ),
    );

    expect(pathsByMode).toEqual([
      ["translations.en.description.main.source", "translations.en.title"],
      ["translations.en.description.main.source", "translations.en.title"],
    ]);
  });

  test("path snapshot compare keeps no-changes empty state when API has no differing paths", () => {
    const result = compareRevisionPathSnapshots({
      unitId: "book-1",
      baseSequence: 2,
      targetSequence: 2,
      candidatePaths: [],
      changes: [],
    });

    expect(result.changes).toEqual([]);
  });

  test("resolves revision compare pairs without comparing a revision to itself", () => {
    expect(resolveRevisionComparePair([5, 4, 3], 5)).toEqual({
      baseSequence: 4,
      targetSequence: 5,
    });
    expect(resolveRevisionComparePair([5, 4, 3], 4)).toEqual({
      baseSequence: 4,
      targetSequence: 5,
    });
    expect(resolveRevisionComparePair([5], 5)).toBeNull();
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
        { extension: { title: "同じ" } },
        { extension: { title: "同じ" } },
      ).changes,
    ).toEqual([]);
  });
});
