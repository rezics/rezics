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

function makeEntity(overrides: Record<string, any> = {}) {
  return {
    unitId: "entity-1",
    kind: "person",
    avatar: "https://cdn.example/liu.png",
    verified: true,
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
      creditedAs: [
        { role: "author", unit: { type: "BOOK" } },
        { role: "author", unit: { type: "BOOK" } },
        { role: "writer", unit: { type: "MEDIA" } },
      ],
      subjectOfAttributions: [
        { role: "primary_character", unit: { type: "POST" } },
      ],
      ...overrides.unit,
    },
    ...overrides.entity,
  };
}

describe("buildEntityDocument", () => {
  test("projects avatar, identity text, and reverse attribution facets", async () => {
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
      creditRoles: ["author", "writer"],
      creditUnitTypes: ["BOOK", "MEDIA"],
      subjectRoles: ["primary_character"],
      subjectUnitTypes: ["POST"],
      creditCount: 3,
      subjectCount: 1,
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
  });
});

describe("SearchClient.initEntityIndex", () => {
  test("configures role facets as filterable attributes", async () => {
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
    expect(settings.filterableAttributes).toContain("creditRoles");
    expect(settings.filterableAttributes).toContain("subjectRoles");
    expect(settings.filterableAttributes).toContain("creditUnitTypes");
    expect(settings.filterableAttributes).toContain("subjectUnitTypes");
  });
});
