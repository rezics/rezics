import { describe, expect, mock, test } from "bun:test";
import { SearchClient } from "./client";

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

const now = new Date("2026-05-20T12:00:00.000Z");

function createDb(rowSets: unknown[][]) {
  const createChain = () => ({
    then(resolve: (value: unknown[]) => unknown) {
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

const entityBaseRow = {
  unitId: "entity-1",
  kind: "person",
  avatar: "https://cdn.example/liu.png",
  verified: true,
  eligibleCreditRoles: ["author", "writer"],
  eligibleSubjectRoles: ["primary_character"],
  slug: "liu-cixin",
  userId: "user-1",
  createdAt: now,
  updatedAt: now,
};

const entityTranslations = [
  {
    unitId: "entity-1",
    language: "en",
    title: "Liu Cixin",
    subtitle: null,
    summary: "Science fiction author",
  },
];

const entityAliases = [
  {
    unitId: "entity-1",
    value: "Cixin Liu",
    status: "ACTIVE",
    score: 1,
    pinned: false,
  },
];

function makeEntity(overrides: Record<string, any> = {}) {
  return {
    unitId: "entity-1",
    kind: "person",
    avatar: "https://cdn.example/liu.png",
    verified: true,
    eligibleCreditRoles: ["author", "writer"],
    eligibleSubjectRoles: ["primary_character"],
    unit: {
      slug: "liu-cixin",
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
      translations: [
        {
          language: "en",
          title: "Liu Cixin",
          subtitle: null,
          summary: "Science fiction author",
        },
        {
          language: "zh-hant",
          title: "Liu Cixin ZH",
          subtitle: null,
          summary: null,
        },
      ],
      ...overrides.unit,
    },
    ...overrides.entity,
  };
}

describe("buildEntityDocument", () => {
  test("projects avatar, identity text, and eligibility facets", async () => {
    setServerEnvForSearchTests();
    const { buildEntityDocument } = await import("./sync");
    const doc = buildEntityDocument(makeEntity());

    expect(doc).toMatchObject({
      id: "entity-1",
      unitId: "entity-1",
      kind: "person",
      verified: true,
      slug: "liu-cixin",
      ownerUnitId: "user-1",
      avatar: "https://cdn.example/liu.png",
      titles: ["Liu Cixin", "Liu Cixin ZH"],
      summaries: ["Science fiction author"],
      eligibleCreditRoles: ["author", "writer"],
      eligibleSubjectRoles: ["primary_character"],
      createdAt: "2026-05-20T12:00:00.000Z",
      updatedAt: "2026-05-20T12:00:00.000Z",
    });
  });

  test("does not expose related Unit id arrays", async () => {
    setServerEnvForSearchTests();
    const { buildEntityDocument } = await import("./sync");
    const doc = buildEntityDocument(makeEntity()) as Record<string, unknown>;

    expect(doc.creditedUnitIds).toBeUndefined();
    expect(doc.subjectUnitIds).toBeUndefined();
    expect(doc.creditRoles).toBeUndefined();
    expect(doc.subjectRoles).toBeUndefined();
    expect(doc.creditCount).toBeUndefined();
    expect(doc.subjectCount).toBeUndefined();
  });
});

describe("SearchClient.initEntityIndex", () => {
  test("configures eligibility facets as filterable attributes", async () => {
    const client = new SearchClient({
      host: "http://localhost:7700",
      apiKey: "",
    });
    const updateSettings = mock(
      async (_settings: Record<string, unknown>) => {},
    );
    const addDocuments = mock(async () => {});
    (client as any).entityIndex = { updateSettings, addDocuments };

    await client.initEntityIndex();

    const settings = updateSettings.mock.calls[0]?.[0] as {
      filterableAttributes: string[];
    };
    expect(settings.filterableAttributes).toContain("eligibleCreditRoles");
    expect(settings.filterableAttributes).toContain("eligibleSubjectRoles");
    expect(settings.filterableAttributes).not.toContain("creditRoles");
    expect(settings.filterableAttributes).not.toContain("subjectRoles");
  });
});

describe("entity search sync", () => {
  test("syncSingleEntity reads Entity, Unit, translations, and aliases through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncSingleEntity } = await import("./sync");
    const documents: unknown[] = [];
    setSearchDb(
      createDb([[entityBaseRow], entityTranslations, entityAliases]) as never,
    );

    await syncSingleEntity(
      {
        addOrUpdateEntities: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      "entity-1",
    );

    expect(documents).toEqual([
      expect.objectContaining({
        id: "entity-1",
        slug: "liu-cixin",
        titles: ["Liu Cixin"],
        summaries: ["Science fiction author"],
        aliasValues: ["Cixin Liu"],
      }),
    ]);
  });

  test("syncSingleEntity deletes stale documents when db row is missing", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncSingleEntity } = await import("./sync");
    const deleted: string[] = [];
    setSearchDb(createDb([[]]) as never);

    await syncSingleEntity(
      {
        deleteEntities: async (ids: string[]) => {
          deleted.push(...ids);
        },
      } as never,
      "entity-missing",
    );

    expect(deleted).toEqual(["entity-missing"]);
  });

  test("patchEntityAliases reads current visible aliases through Drizzle", async () => {
    setServerEnvForSearchTests();
    const { patchEntityAliases, setSearchDb } = await import("./sync");
    const patched: unknown[] = [];
    setSearchDb(
      createDb([
        [entityBaseRow],
        entityTranslations,
        entityAliases,
        [{ value: "Pinned Alias" }],
      ]) as never,
    );

    await patchEntityAliases(
      {
        patchEntities: async (input: unknown[]) => {
          patched.push(...input);
        },
      } as never,
      "entity-1",
    );

    expect(patched).toEqual([
      {
        id: "entity-1",
        aliasValues: ["Pinned Alias"],
      },
    ]);
  });

  test("syncEntitySegment returns cursor from Drizzle rows", async () => {
    setServerEnvForSearchTests();
    const { setSearchDb, syncEntitySegment } = await import("./sync");
    const documents: unknown[] = [];
    setSearchDb(
      createDb([
        [
          entityBaseRow,
          {
            ...entityBaseRow,
            unitId: "entity-2",
            slug: "entity-two",
          },
        ],
        entityTranslations,
        entityAliases,
      ]) as never,
    );

    const result = await syncEntitySegment(
      {
        addOrUpdateEntities: async (input: unknown[]) => {
          documents.push(...input);
        },
      } as never,
      { limit: 1, cursor: "entity-0" },
    );

    expect(result).toEqual({ processed: 1, nextCursor: "entity-1" });
    expect(documents).toHaveLength(1);
  });
});
