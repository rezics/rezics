import { describe, expect, it } from "bun:test";
import type { RealmTagTreeNode } from "@rezics/contract";
import {
  collectRealmStreamTagChips,
  orderRealmStreamTagChips,
  REALM_STREAM_TAG_SHORTCUT_LIMIT,
  toggleRealmStreamTagId,
} from "./realmStreamTagFilter";

const tagTree = [
  {
    kind: "tag",
    tagUnitId: "tag-a",
    children: [
      {
        kind: "tag",
        tagUnitId: "tag-b",
      },
    ],
  },
  {
    kind: "tag",
    tagUnitId: "tag-c",
    querySource: "policy",
  },
] satisfies RealmTagTreeNode[];

const displayNames = new Map<string, string>([
  ["tag-a", "Alpha"],
  ["tag-b", "Beta"],
  ["tag-c", "Gamma"],
]);

describe("realm stream tag filter helpers", () => {
  it("collects tag chips in tree order with hydrated labels", () => {
    expect(collectRealmStreamTagChips(tagTree, displayNames)).toEqual([
      { tagId: "tag-a", label: "Alpha", querySource: "normal" },
      { tagId: "tag-b", label: "Beta", querySource: "normal" },
      { tagId: "tag-c", label: "Gamma", querySource: "policy" },
    ]);
  });

  it("orders selected tags first without changing relative tree order", () => {
    const chips = collectRealmStreamTagChips(tagTree, displayNames);

    expect(
      orderRealmStreamTagChips(chips, ["tag-a"], ["tag-c"], 12).map(
        (chip) => chip.tagId,
      ),
    ).toEqual(["tag-a", "tag-c", "tag-b"]);
  });

  it("caps unselected shortcut tags while preserving selected tags", () => {
    const chips = Array.from(
      { length: REALM_STREAM_TAG_SHORTCUT_LIMIT + 3 },
      (_, index) => ({
        tagId: "tag-" + (index + 1),
        label: "Tag " + (index + 1),
        querySource: "normal" as const,
      }),
    );
    const selected = "tag-" + (REALM_STREAM_TAG_SHORTCUT_LIMIT + 3);

    expect(
      orderRealmStreamTagChips(chips, [selected]).map((chip) => chip.tagId),
    ).toEqual([
      selected,
      ...Array.from(
        { length: REALM_STREAM_TAG_SHORTCUT_LIMIT },
        (_, index) => "tag-" + (index + 1),
      ),
    ]);
  });

  it("toggles stream tags as a multi-select set", () => {
    expect(toggleRealmStreamTagId(["tag-a"], "tag-b")).toEqual([
      "tag-a",
      "tag-b",
    ]);
    expect(toggleRealmStreamTagId(["tag-a", "tag-b"], "tag-a")).toEqual([
      "tag-b",
    ]);
  });
});
