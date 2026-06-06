import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    // biome-ignore lint/suspicious/noThenProperty: Drizzle test double must be awaitable.
    ["then"](resolve: (value: unknown[]) => unknown) {
      return Promise.resolve(resolve(rowSets.shift() ?? []));
    },
    leftJoin() {
      return createChain();
    },
    where() {
      return createChain();
    },
    orderBy() {
      return createChain();
    },
    async limit() {
      return rowSets.shift() ?? [];
    },
  });

  return {
    select() {
      return {
        from() {
          return createChain();
        },
      };
    },
  };
}

function setServerEnvForSearchTests() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@localhost:5432/rezics_book";
  process.env.AUTH_INTERNAL_BASE_URL ??= "http://localhost:4001";
  process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:4001";
  process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:4001";
  process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "test-secret";
  process.env.SMTP_HOST ??= "localhost";
  process.env.SMTP_USER ??= "test";
  process.env.SMTP_PASSWORD ??= "test";
  process.env.TURNSTILE_SECRET ??= "test";
  process.env.MEILI_HOST ??= "http://localhost:7700";
  process.env.MEILI_MASTER_KEY ??= "masterKey";
  process.env.NOTIFY_BASE_URL ??= "http://localhost:4002";
  process.env.NOTIFY_INTERNAL_SECRET ??= "test-secret";
  process.env.REACTION_BASE_URL ??= "http://localhost:4003";
  process.env.REACTION_INTERNAL_SECRET ??= "test-secret";
}

const realmBaseRow = {
  unitId: "realm-1",
  isPublic: true,
  isOfficial: false,
  memberCount: 7,
  extra: null,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  unitStatus: "PUBLISHED",
  userId: "user-1",
  isLanguageNeutral: false,
};

describe("realm search patch sync", () => {
  test("patchRealmMemberCountFromDb reads Realm through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchRealmMemberCountFromDb, setSearchDb } = await import("./sync");
    const patchRealms = mock(async (_docs: unknown[]) => undefined);
    const deleteRealms = mock(async (_ids: string[]) => undefined);
    setSearchDb(createDb([[{ memberCount: 42 }]]) as never);

    await patchRealmMemberCountFromDb(
      { patchRealms, deleteRealms } as never,
      "realm-1",
    );

    expect(patchRealms).toHaveBeenCalledWith([
      { id: "realm-1", memberCount: 42 },
    ]);
    expect(deleteRealms).not.toHaveBeenCalled();
  });

  test("patchRealmMemberCountFromDb deletes missing realms", async () => {
    setServerEnvForSearchTests();
    const { patchRealmMemberCountFromDb, setSearchDb } = await import("./sync");
    const patchRealms = mock(async (_docs: unknown[]) => undefined);
    const deleteRealms = mock(async (_ids: string[]) => undefined);
    setSearchDb(createDb([[]]) as never);

    await patchRealmMemberCountFromDb(
      { patchRealms, deleteRealms } as never,
      "realm-missing",
    );

    expect(deleteRealms).toHaveBeenCalledWith(["realm-missing"]);
    expect(patchRealms).not.toHaveBeenCalled();
  });

  test("patchRealmTranslations reads UnitTranslation through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchRealmTranslations, setSearchDb } = await import("./sync");
    const patchRealms = mock(async (_docs: unknown[]) => undefined);
    setSearchDb(
      createDb([
        [
          {
            language: "en",
            title: "Realm title",
            description: markdownContentDoc("Realm description"),
          },
        ],
      ]) as never,
    );

    await patchRealmTranslations({ patchRealms } as never, "realm-1");

    expect(patchRealms).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "realm-1",
        titles: ["Realm title"],
        descriptions: ["Realm description"],
        descriptionText: "Realm description",
      }),
    ]);
  });

  test("patchRealmAliases reads published Realm aliases through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchRealmAliases, setSearchDb } = await import("./sync");
    const patchRealms = mock(async (_docs: unknown[]) => undefined);
    const deleteRealms = mock(async (_ids: string[]) => undefined);
    setSearchDb(
      createDb([
        [{ unitId: "realm-1", unitStatus: "PUBLISHED" }],
        [{ value: "Readers" }, { value: "Book club" }],
      ]) as never,
    );

    await patchRealmAliases({ patchRealms, deleteRealms } as never, "realm-1");

    expect(patchRealms).toHaveBeenCalledWith([
      { id: "realm-1", aliasValues: ["Readers", "Book club"] },
    ]);
    expect(deleteRealms).not.toHaveBeenCalled();
  });

  test("patchRealmAliases deletes missing or unpublished realms", async () => {
    setServerEnvForSearchTests();
    const { patchRealmAliases, setSearchDb } = await import("./sync");
    const patchRealms = mock(async (_docs: unknown[]) => undefined);
    const deleteRealms = mock(async (_ids: string[]) => undefined);
    setSearchDb(
      createDb([[{ unitId: "realm-1", unitStatus: "DRAFT" }]]) as never,
    );

    await patchRealmAliases({ patchRealms, deleteRealms } as never, "realm-1");

    expect(deleteRealms).toHaveBeenCalledWith(["realm-1"]);
    expect(patchRealms).not.toHaveBeenCalled();
  });
});

describe("realm search full sync", () => {
  test("syncSingleRealm reads Realm graph through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncSingleRealm } = await import("./sync");
    const addOrUpdateRealms = mock(async (_docs: unknown[]) => undefined);
    const deleteRealms = mock(async (_ids: string[]) => undefined);
    setSearchDb(
      createDb([
        [realmBaseRow],
        [
          {
            unitId: "realm-1",
            language: "en",
            title: "Readers",
            description: markdownContentDoc("Book club"),
          },
        ],
        [{ unitId: "realm-1", language: "en", isPrimary: true, sortOrder: 0 }],
        [
          {
            unitId: "realm-1",
            value: "Book friends",
            score: 4,
            pinned: false,
            status: "ACTIVE",
          },
        ],
      ]) as never,
    );

    await syncSingleRealm(
      { addOrUpdateRealms, deleteRealms } as never,
      "realm-1",
    );

    expect(addOrUpdateRealms).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "realm-1",
        titles: ["Readers"],
        descriptions: ["Book club"],
        aliasValues: ["Book friends"],
        languages: ["en"],
      }),
    ]);
    expect(deleteRealms).not.toHaveBeenCalled();
  });

  test("syncSingleRealm deletes missing or unpublished realms", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncSingleRealm } = await import("./sync");
    const addOrUpdateRealms = mock(async (_docs: unknown[]) => undefined);
    const deleteRealms = mock(async (_ids: string[]) => undefined);
    setSearchDb(
      createDb([
        [{ ...realmBaseRow, unitStatus: "DRAFT" }],
        [],
        [],
        [],
        [],
      ]) as never,
    );

    await syncSingleRealm(
      { addOrUpdateRealms, deleteRealms } as never,
      "realm-draft",
    );
    await syncSingleRealm(
      { addOrUpdateRealms, deleteRealms } as never,
      "realm-missing",
    );

    expect(deleteRealms).toHaveBeenCalledWith(["realm-draft"]);
    expect(deleteRealms).toHaveBeenCalledWith(["realm-missing"]);
    expect(addOrUpdateRealms).not.toHaveBeenCalled();
  });

  test("syncAllRealms reads published realm batches through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncAllRealms } = await import("./sync");
    const addOrUpdateRealms = mock(async (_docs: unknown[]) => undefined);
    setSearchDb(createDb([[realmBaseRow], [], [], [], []]) as never);

    const result = await syncAllRealms({
      deleteAllRealms: async () => ({}),
      addOrUpdateRealms,
    } as never);

    expect(result).toEqual({
      message: "syncAllRealms success",
      totalSynced: 1,
    });
    expect(addOrUpdateRealms).toHaveBeenCalledTimes(1);
  });

  test("syncRealmSegment returns cursor from Drizzle rows", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncRealmSegment } = await import("./sync");
    const addOrUpdateRealms = mock(async (_docs: unknown[]) => undefined);
    setSearchDb(
      createDb([
        [realmBaseRow, { ...realmBaseRow, unitId: "realm-2" }],
        [],
        [],
        [],
      ]) as never,
    );

    const result = await syncRealmSegment({ addOrUpdateRealms } as never, {
      limit: 1,
    });

    expect(result).toEqual({ processed: 1, nextCursor: "realm-1" });
    expect(addOrUpdateRealms).toHaveBeenCalledTimes(1);
  });
});
