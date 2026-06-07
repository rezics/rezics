import { describe, expect, test } from "bun:test";
import type { TagTreeNode } from "@rezics/contract";
import {
  buildRealmTagTreePickerRows,
  searchRealmTagTreePickerRows,
  selectedRealmTagLabels,
} from "./realmTagTreePicker";

describe("realm tag tree picker model", () => {
  const tree: TagTreeNode[] = [
    {
      label: "Works",
      children: [
        {
          tagId: "tag-road",
          label: "The Road",
          children: [{ tagId: "tag-road-ending", label: "Ending" }],
        },
        {
          tagId: "tag-untitled-work",
        },
      ],
    },
    {
      label: "Works",
      children: [{ tagId: "tag-other-road", label: "The Road" }],
    },
  ];

  test("derives label-only group rows and selectable tag-backed rows", () => {
    const rows = buildRealmTagTreePickerRows(tree, "en");
    expect(rows[0]).toMatchObject({
      label: "Works",
      selectable: false,
      tagId: undefined,
    });
    expect(rows[0]?.children[0]).toMatchObject({
      label: "The Road",
      tagId: "tag-road",
      selectable: true,
    });
    expect(rows[0]?.children[0]?.children[0]).toMatchObject({
      label: "Ending",
      tagId: "tag-road-ending",
      selectable: true,
    });
  });

  test("keeps duplicated labels addressable with stable path ids", () => {
    const rows = buildRealmTagTreePickerRows(tree, "en");
    expect(rows[0]?.id).toBe("0:Works");
    expect(rows[1]?.id).toBe("1:Works");
    expect(rows[0]?.children[0]?.id).toBe("0:Works/0:tag-road");
  });

  test("uses tag id fallback labels when a node has no label", () => {
    const rows = buildRealmTagTreePickerRows(tree, "en");
    expect(rows[0]?.children[1]?.label).toBe("tag-unti");
  });

  test("searches loaded realm tree rows and preserves path context", () => {
    const rows = buildRealmTagTreePickerRows(tree, "en");
    const matches = searchRealmTagTreePickerRows(rows, "ending");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      tagId: "tag-road-ending",
      pathLabel: "Works / The Road",
      matchText: "Works / The Road / Ending",
    });
  });

  test("derives selected labels from tree rows with fallback for global tags", () => {
    const rows = buildRealmTagTreePickerRows(tree, "en");
    const labels = selectedRealmTagLabels(
      rows,
      ["tag-road", "tag-global"],
      (tagId) => `fallback:${tagId}`,
    );
    expect(labels.get("tag-road")).toBe("The Road");
    expect(labels.get("tag-global")).toBe("fallback:tag-global");
  });
});
