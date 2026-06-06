import { beforeEach, describe, expect, mock, test } from "bun:test";

const hasAuthorityOverMock = mock(async () => false);

mock.module("@/unit/authority", () => ({
  hasAuthorityOver: hasAuthorityOverMock,
}));

const {
  clearSingleExtraKey,
  filterRealmExtraPublic,
  readListAdmin,
  readListPublic,
  setRealmExtraRepositoryForTest,
  setSingleExtraKey,
  setTagTreeExtra,
} = await import("./realm-extra.service");

let storedExtra: Record<string, unknown> = {};
let memberRow: { realmUnitId: string } | null = { realmUnitId: "realm-1" };

const updateExtraWithLockMock = mock(
  async (
    _realmId: string,
    mutate: (extra: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    storedExtra = mutate(storedExtra);
    return storedExtra;
  },
);

const repository = {
  findLiveUnitReferenceIds: mock(async (ids: string[]) => {
    return new Set(ids.filter((id) => id.startsWith("post-")));
  }),
  findRealmAuthorityUnit: mock(async (realmId: string) =>
    realmId === "realm-1"
      ? { id: realmId, userId: "owner-1", type: "REALM" }
      : null,
  ),
  findRealmAuthorityMember: mock(async () => memberRow),
  loadExtra: mock(async () => storedExtra),
  findPostUnit: mock(async (id: string) => {
    if (id.startsWith("post-")) {
      return { id, type: "POST", status: "PUBLISHED" };
    }
    if (id === "book-1") {
      return { id, type: "BOOK", status: "PUBLISHED" };
    }
    if (id === "deleted-post") {
      return { id, type: "POST", status: "DELETED" };
    }
    return null;
  }),
  findValidTagUnitIds: mock(async (ids: string[]) => {
    return new Set(ids.filter((id) => id.startsWith("tag-")));
  }),
  zoneExists: mock(async (unitId: string) => unitId.startsWith("zone-")),
  updateExtraWithLock: updateExtraWithLockMock,
  findVisibleUnitIds: mock(async (ids: string[]) => {
    return new Set(ids.filter((id) => id.startsWith("post-")));
  }),
  findLiveUnitIds: mock(async (ids: string[]) => {
    return new Set(ids.filter((id) => id.startsWith("post-")));
  }),
};

setRealmExtraRepositoryForTest(repository);

const caller = {
  unitId: "user-1",
  userId: "user-1",
  permission: { role: "MEMBER" },
} as any;

describe("realm extra single-key service", () => {
  beforeEach(() => {
    storedExtra = {};
    memberRow = { realmUnitId: "realm-1" };
    hasAuthorityOverMock.mockClear();
    hasAuthorityOverMock.mockResolvedValue(false);
    for (const value of Object.values(repository)) {
      if (typeof value === "function" && "mockClear" in value) {
        value.mockClear();
      }
    }
  });

  test("sets and replaces rule/about/banner/tag view/wiki Zone keys", async () => {
    await setSingleExtraKey(caller, "realm-1", "rule", "post-rule");
    expect(storedExtra.rule).toBe("post-rule");

    await setSingleExtraKey(caller, "realm-1", "about", "post-about");
    expect(storedExtra.about).toBe("post-about");

    await setSingleExtraKey(caller, "realm-1", "banner", {
      kind: "url",
      url: "https://example.com/banner.png",
    });
    expect(storedExtra.banner).toEqual({
      kind: "url",
      url: "https://example.com/banner.png",
    });

    await setSingleExtraKey(caller, "realm-1", "banner", {
      kind: "post",
      unitId: "post-banner",
    });
    expect(storedExtra.banner).toEqual({
      kind: "post",
      unitId: "post-banner",
    });

    await setSingleExtraKey(caller, "realm-1", "tagView", {
      defaultStyle: "grouped",
      allowViewerSwitch: false,
    });
    expect(storedExtra.tagView).toEqual({
      defaultStyle: "grouped",
      allowViewerSwitch: false,
    });

    await setSingleExtraKey(caller, "realm-1", "wikiZoneUnitId", "zone-wiki");
    expect(storedExtra.wikiZoneUnitId).toBe("zone-wiki");
  });

  test("clears each supported key", async () => {
    storedExtra = {
      rule: "post-rule",
      about: "post-about",
      banner: { kind: "url", url: "https://example.com/banner.png" },
      tagView: { defaultStyle: "tree", allowViewerSwitch: true },
      tagTree: [{ tagId: "tag-action" }],
      wikiZoneUnitId: "zone-wiki",
    };

    await clearSingleExtraKey(caller, "realm-1", "rule");
    await clearSingleExtraKey(caller, "realm-1", "about");
    await clearSingleExtraKey(caller, "realm-1", "banner");
    await clearSingleExtraKey(caller, "realm-1", "tagView");
    await clearSingleExtraKey(caller, "realm-1", "tagTree");
    await clearSingleExtraKey(caller, "realm-1", "wikiZoneUnitId");

    expect(storedExtra).toEqual({});
  });

  test("rejects nonexistent ids and bad shapes", async () => {
    await expect(
      setSingleExtraKey(caller, "realm-1", "rule", "missing-post"),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "about", "book-1"),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "banner", { kind: "post" }),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "wikiZoneUnitId", "missing-zone"),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "tagView", {
        defaultStyle: "columns",
        allowViewerSwitch: true,
      }),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "tagView", {
        defaultStyle: "flat",
      }),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setTagTreeExtra(caller, "realm-1", [{ children: [{ tagId: "tag-a" }] }]),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setTagTreeExtra(caller, "realm-1", [{ tagId: "missing-tag" }]),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setTagTreeExtra(caller, "realm-1", [{ label: "Hidden", disabled: true }]),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
  });

  test("sets tagTree with label-only nodes and tag-backed nodes at any depth", async () => {
    await setTagTreeExtra(caller, "realm-1", [
      {
        label: "Genre",
        children: [
          {
            tagId: "tag-action",
            children: [
              {
                labelTranslations: {
                  translations: { en: "Mood" },
                  fallbackLanguage: "en",
                },
                children: [{ tagId: "tag-drama" }],
              },
            ],
          },
        ],
      },
      { labelUnitId: "label-unit-1" },
    ]);

    expect(storedExtra.tagTree).toEqual([
      {
        label: "Genre",
        children: [
          {
            tagId: "tag-action",
            children: [
              {
                labelTranslations: {
                  translations: { en: "Mood" },
                  fallbackLanguage: "en",
                },
                children: [{ tagId: "tag-drama" }],
              },
            ],
          },
        ],
      },
      { labelUnitId: "label-unit-1" },
    ]);
  });

  test("rejects non-moderator callers", async () => {
    memberRow = null;

    await expect(
      setSingleExtraKey(caller, "realm-1", "rule", "post-rule"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });

  test("serializes writes through the realm row lock", async () => {
    await setSingleExtraKey(caller, "realm-1", "rule", "post-rule");
    await setSingleExtraKey(caller, "realm-1", "about", "post-about");

    expect(updateExtraWithLockMock).toHaveBeenCalledTimes(2);
  });

  test("public stale filtering removes stale rule/about/banner post references", async () => {
    const extra = await filterRealmExtraPublic({
      rule: "post-rule",
      about: "missing-post",
      banner: { kind: "post", unitId: "deleted-post" },
      tagTree: [{ tagId: "tag-action" }],
    });

    expect(extra).toEqual({
      rule: "post-rule",
      tagTree: [{ tagId: "tag-action" }],
    });
  });

  test("single-key public and admin reads surface stale markers", async () => {
    storedExtra = {
      rule: "missing-post",
      banner: { kind: "post", unitId: "post-banner" },
    };

    await expect(readListPublic(null, "realm-1", "rule")).resolves.toEqual([]);
    await expect(readListPublic(null, "realm-1", "banner")).resolves.toEqual([
      "post-banner",
    ]);
    await expect(readListAdmin(caller, "realm-1", "rule")).resolves.toEqual({
      unitIds: ["missing-post"],
      staleIds: ["missing-post"],
    });
  });
});
