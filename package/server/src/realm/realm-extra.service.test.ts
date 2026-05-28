import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const hasAuthorityOverMock = mock(async () => false);

mock.module("@/unit/authority", () => ({
  hasAuthorityOver: hasAuthorityOverMock,
}));

let storedExtra: Record<string, unknown> = {};
const queryRawMock = mock(async () => [{ "?column?": 1 }]);
const realmFindUniqueOrThrowMock = mock(async () => ({ extra: storedExtra }));
const realmUpdateMock = mock(async ({ data }: any) => {
  storedExtra = data.extra;
  return { extra: storedExtra };
});
const realmMemberFindFirstMock = mock(async () => ({ realmUnitId: "realm-1" }));
const unitFindUniqueMock = mock(async ({ where }: any) => {
  const id = where.id as string;
  if (id === "realm-1") {
    return { id, userId: "owner-1", type: "REALM", status: "PUBLISHED" };
  }
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
});
const unitFindManyMock = mock(async ({ where }: any) => {
  const ids = where.id.in as string[];
  if (where.type === "POST") {
    return ids.filter((id) => id.startsWith("post-")).map((id) => ({ id }));
  }
  return ids.filter((id) => id.startsWith("tag-")).map((id) => ({ id }));
});
const zoneFindUniqueMock = mock(async ({ where }: any) => {
  const unitId = where.unitId as string;
  return unitId.startsWith("zone-") ? { unitId } : null;
});
const transactionMock = mock(async (fn: any) =>
  fn({
    $queryRaw: queryRawMock,
    realm: {
      findUniqueOrThrow: realmFindUniqueOrThrowMock,
      update: realmUpdateMock,
    },
  }),
);

Object.assign(prismaMock, {
  $transaction: transactionMock,
  realm: {
    findUniqueOrThrow: realmFindUniqueOrThrowMock,
    update: realmUpdateMock,
  },
  realmMember: { findFirst: realmMemberFindFirstMock },
  unit: {
    findUnique: unitFindUniqueMock,
    findMany: unitFindManyMock,
  },
  zone: {
    findUnique: zoneFindUniqueMock,
  },
});

const {
  clearSingleExtraKey,
  filterRealmExtraPublic,
  readListAdmin,
  readListPublic,
  setSingleExtraKey,
  setTagTreeExtra,
} = await import("./realm-extra.service");

const caller = {
  unitId: "user-1",
  permission: { role: "MEMBER" },
} as any;

describe("realm extra single-key service", () => {
  beforeEach(() => {
    storedExtra = {};
    hasAuthorityOverMock.mockClear();
    hasAuthorityOverMock.mockResolvedValue(false);
    queryRawMock.mockClear();
    realmFindUniqueOrThrowMock.mockClear();
    realmUpdateMock.mockClear();
    realmMemberFindFirstMock.mockClear();
    realmMemberFindFirstMock.mockResolvedValue({ realmUnitId: "realm-1" });
    unitFindUniqueMock.mockClear();
    unitFindManyMock.mockClear();
    zoneFindUniqueMock.mockClear();
    transactionMock.mockClear();
  });

  test("sets and replaces rule/about/banner/wiki Zone keys", async () => {
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

    await setSingleExtraKey(caller, "realm-1", "wikiZoneUnitId", "zone-wiki");
    expect(storedExtra.wikiZoneUnitId).toBe("zone-wiki");
  });

  test("clears each supported key", async () => {
    storedExtra = {
      rule: "post-rule",
      about: "post-about",
      banner: { kind: "url", url: "https://example.com/banner.png" },
      tagTree: [{ tagId: "tag-action" }],
      wikiZoneUnitId: "zone-wiki",
    };

    await clearSingleExtraKey(caller, "realm-1", "rule");
    await clearSingleExtraKey(caller, "realm-1", "about");
    await clearSingleExtraKey(caller, "realm-1", "banner");
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
      setTagTreeExtra(caller, "realm-1", [{ label: "Genre" }]),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
    await expect(
      setTagTreeExtra(caller, "realm-1", [{ tagId: "missing-tag" }]),
    ).rejects.toMatchObject({ code: "INVALID_VALUE", httpStatus: 400 });
  });

  test("sets tagTree with valid headers and tag leaves", async () => {
    await setTagTreeExtra(caller, "realm-1", [
      {
        disabled: true,
        label: "Genre",
        children: [{ tagId: "tag-action" }, { tagId: "tag-drama" }],
      },
    ]);

    expect(storedExtra.tagTree).toEqual([
      {
        disabled: true,
        label: "Genre",
        children: [{ tagId: "tag-action" }, { tagId: "tag-drama" }],
      },
    ]);
  });

  test("rejects non-moderator callers", async () => {
    realmMemberFindFirstMock.mockResolvedValueOnce(null as any);

    await expect(
      setSingleExtraKey(caller, "realm-1", "rule", "post-rule"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });

  test("serializes writes through the realm row lock", async () => {
    await setSingleExtraKey(caller, "realm-1", "rule", "post-rule");
    await setSingleExtraKey(caller, "realm-1", "about", "post-about");

    expect(queryRawMock).toHaveBeenCalledTimes(2);
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
