import { describe, expect, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { mapJoinedRealmToListItem } from "../models/realmListItem";

describe("mapJoinedRealmToListItem", () => {
  test("uses resolved realm display fields instead of first translation row", () => {
    const item = mapJoinedRealmToListItem({
      unitId: "realm-1",
      slug: "realm",
      isPublic: true,
      isOfficial: false,
      memberCount: 3,
      resolvedLanguage: "zh-hant",
      title: "中文領域",
      description: markdownContentDoc("中文介紹"),
      translations: [
        {
          unitId: "realm-1",
          language: "en",
          title: "English realm",
          description: markdownContentDoc("English description"),
        },
      ],
    });

    expect(item.title).toBe("中文領域");
    expect(item.description).toBe("中文介紹");
  });
});
