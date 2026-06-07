import { describe, expect, it } from "bun:test";
import type { TagTreeNode } from "@rezics/contract";
import {
  collectRealmFeedTagChips,
  orderRealmFeedTagChips,
  REALM_FEED_TAG_SHORTCUT_LIMIT,
  toggleRealmFeedTagId,
} from "./realmFeedTagFilter";

const tagTree = [
  {
    tagId: "tag-a",
    label: "Alpha",
    children: [
      {
        tagId: "tag-b",
        label: "Beta",
      },
    ],
  },
  {
    tagId: "tag-c",
    labelTranslations: {
      fallbackLanguage: "en",
      translations: {
        en: "Gamma",
        "zh-Hant": "伽瑪",
      },
    },
  },
] satisfies TagTreeNode[];

describe("realm feed tag filter helpers", () => {
  it("collects tag chips in tree order with localized labels", () => {
    expect(collectRealmFeedTagChips(tagTree, "zh-Hant")).toEqual([
      { tagId: "tag-a", label: "Alpha" },
      { tagId: "tag-b", label: "Beta" },
      { tagId: "tag-c", label: "伽瑪" },
    ]);
  });

  it("orders selected tags first without changing relative tree order", () => {
    const chips = collectRealmFeedTagChips(tagTree, "en");

    expect(
      orderRealmFeedTagChips(chips, ["tag-c", "tag-a"], 12).map(
        (chip) => chip.tagId,
      ),
    ).toEqual(["tag-a", "tag-c", "tag-b"]);
  });

  it("caps unselected shortcut tags while preserving selected tags", () => {
    const chips = Array.from(
      { length: REALM_FEED_TAG_SHORTCUT_LIMIT + 3 },
      (_, index) => ({
        tagId: `tag-${index + 1}`,
        label: `Tag ${index + 1}`,
      }),
    );

    expect(
      orderRealmFeedTagChips(chips, [
        `tag-${REALM_FEED_TAG_SHORTCUT_LIMIT + 3}`,
      ]).map((chip) => chip.tagId),
    ).toEqual([
      `tag-${REALM_FEED_TAG_SHORTCUT_LIMIT + 3}`,
      ...Array.from(
        { length: REALM_FEED_TAG_SHORTCUT_LIMIT },
        (_, index) => `tag-${index + 1}`,
      ),
    ]);
  });

  it("toggles feed tags as a multi-select set", () => {
    expect(toggleRealmFeedTagId(["tag-a"], "tag-b")).toEqual([
      "tag-a",
      "tag-b",
    ]);
    expect(toggleRealmFeedTagId(["tag-a", "tag-b"], "tag-a")).toEqual([
      "tag-b",
    ]);
  });
});
