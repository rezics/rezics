import { beforeEach, describe, expect, mock, test } from "bun:test";

const hasAuthorityOverMock = mock(async () => false);

mock.module("@/unit/authority", () => ({
  hasAuthorityOver: hasAuthorityOverMock,
}));

const {
  clearSingleExtraKey,
  filterRealmExtraPublic,
  setRealmExtraRepositoryForTest,
  setSingleExtraKey,
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
  findRealmAuthorityUnit: mock(async (realmId: string) =>
    realmId === "realm-1"
      ? { id: realmId, userId: "owner-1", type: "REALM" }
      : null,
  ),
  findRealmAuthorityMember: mock(async () => memberRow),
  updateExtraWithLock: updateExtraWithLockMock,
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

  test("sets and replaces supported extra keys", async () => {
    await setSingleExtraKey(caller, "realm-1", "banner", {
      kind: "url",
      url: "https://example.com/banner.png",
    });
    expect(storedExtra.banner).toEqual({
      kind: "url",
      url: "https://example.com/banner.png",
    });

    await setSingleExtraKey(caller, "realm-1", "avatar", {
      kind: "url",
      url: "https://example.com/avatar.png",
    });
    expect(storedExtra.avatar).toEqual({
      kind: "url",
      url: "https://example.com/avatar.png",
    });

    await setSingleExtraKey(
      caller,
      "realm-1",
      "defaultLicenseSlug",
      "cc-by-nc-sa-4.0",
    );
    expect(storedExtra.defaultLicenseSlug).toBe("cc-by-nc-sa-4.0");
  });

  test("clears each supported key", async () => {
    storedExtra = {
      avatar: { kind: "url", url: "https://example.com/avatar.png" },
      banner: { kind: "url", url: "https://example.com/banner.png" },
      defaultLicenseSlug: "cc-by-nc-sa-4.0",
    };

    await clearSingleExtraKey(caller, "realm-1", "avatar");
    await clearSingleExtraKey(caller, "realm-1", "banner");
    await clearSingleExtraKey(caller, "realm-1", "defaultLicenseSlug");

    expect(storedExtra).toEqual({});
  });

  test("rejects old composed-surface keys and bad values", async () => {
    await expect(
      setSingleExtraKey(caller, "realm-1", "rule", "missing-post"),
    ).rejects.toMatchObject({ code: "INVALID_KEY", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "about", "book-1"),
    ).rejects.toMatchObject({ code: "INVALID_KEY", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "tagView", {
        defaultStyle: "flat",
        allowViewerSwitch: true,
      }),
    ).rejects.toMatchObject({ code: "INVALID_KEY", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "tagTree", [{ tagId: "tag-a" }]),
    ).rejects.toMatchObject({ code: "INVALID_KEY", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "pinboard", []),
    ).rejects.toMatchObject({ code: "INVALID_KEY", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "banner", { kind: "post" }),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "avatar", {
        kind: "url",
        url: "file:///tmp/avatar.png",
      }),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setSingleExtraKey(caller, "realm-1", "defaultLicenseSlug", "unknown"),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
  });

  test("rejects non-moderator callers", async () => {
    memberRow = null;

    await expect(
      setSingleExtraKey(caller, "realm-1", "banner", {
        kind: "url",
        url: "https://example.com/banner.png",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });

  test("serializes writes through the realm row lock", async () => {
    await setSingleExtraKey(caller, "realm-1", "banner", {
      kind: "url",
      url: "https://example.com/banner.png",
    });
    await setSingleExtraKey(caller, "realm-1", "avatar", {
      kind: "url",
      url: "https://example.com/avatar.png",
    });

    expect(updateExtraWithLockMock).toHaveBeenCalledTimes(2);
  });

  test("public filtering keeps supported keys", async () => {
    const extra = await filterRealmExtraPublic({
      banner: { kind: "url", url: "https://example.com/banner.png" },
      defaultLicenseSlug: "cc-by-nc-sa-4.0",
    });

    expect(extra).toEqual({
      banner: { kind: "url", url: "https://example.com/banner.png" },
      defaultLicenseSlug: "cc-by-nc-sa-4.0",
    });
  });

  test("public stale filtering removes invalid and no-longer-owned keys", async () => {
    const extra = await filterRealmExtraPublic({
      banner: { kind: "post", unitId: "post-banner" },
      avatar: { kind: "url", url: "file:///tmp/avatar.png" },
      tagTree: [{ tagId: "tag-action" }],
      tagView: { defaultStyle: "flat", allowViewerSwitch: true },
      rule: "post-1",
    });

    expect(extra).toEqual({});
  });
});
