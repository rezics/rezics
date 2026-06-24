import { describe, expect, test } from "bun:test";
import type { RealmTagTreeNode } from "@rezics/contract";
import {
  buildRealmTagTreePickerRows,
  searchRealmTagTreePickerRows,
  selectedRealmTagLabels,
} from "./realmTagTreePicker";

const displayNames = new Map<string, string>([
  ["label-works", "Works"],
  ["tag-road", "The Road"],
  ["tag-road-ending", "Ending"],
  ["tag-other-road", "The Road"],
]);

describe("realm tag tree picker model", () => {
  const tree: RealmTagTreeNode[] = [
    {
      kind: "label",
      labelUnitId: "label-works",
      children: [
        {
          kind: "tag",
          tagUnitId: "tag-road",
          children: [{ kind: "tag", tagUnitId: "tag-road-ending" }],
        },
        {
          kind: "tag",
          tagUnitId: "tag-untitled-work",
        },
      ],
    },
    {
      kind: "label",
      labelUnitId: "label-works",
      children: [{ kind: "tag", tagUnitId: "tag-other-road" }],
    },
  ];

  test("derives label rows and selectable global tag rows", () => {
    const rows = buildRealmTagTreePickerRows(tree, displayNames);
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
    const rows = buildRealmTagTreePickerRows(tree, displayNames);
    expect(rows[0]?.id).toBe("0:label-works");
    expect(rows[1]?.id).toBe("1:label-works");
    expect(rows[0]?.children[0]?.id).toBe("0:label-works/0:tag-road");
  });

  test("uses tag id fallback labels when a node has no hydrated name", () => {
    const rows = buildRealmTagTreePickerRows(tree, displayNames);
    expect(rows[0]?.children[1]?.label).toBe("tag-unti");
  });

  test("searches loaded realm tree rows and preserves path context", () => {
    const rows = buildRealmTagTreePickerRows(tree, displayNames);
    const matches = searchRealmTagTreePickerRows(rows, "ending");
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      tagId: "tag-road-ending",
      pathLabel: "Works / The Road",
      matchText: "Works / The Road / Ending",
    });
  });

  test("derives selected labels from tree rows with fallback for global tags", () => {
    const rows = buildRealmTagTreePickerRows(tree, displayNames);
    const labels = selectedRealmTagLabels(
      rows,
      ["tag-road", "tag-global"],
      (tagId) => "fallback:" + tagId,
    );
    expect(labels.get("tag-road")).toBe("The Road");
    expect(labels.get("tag-global")).toBe("fallback:tag-global");
  });
});
