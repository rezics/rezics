import { describe, expect, mock, test } from "bun:test";
import { EXPECTED_MEILI_INDEX_SCHEMAS } from "@rezics/search";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_INTERNAL_BASE_URL ??= "http://localhost:3001";
process.env.AUTH_PUBLIC_BASE_URL ??= "http://localhost:3001";
process.env.AUTH_PUBLIC_ISSUER_URL ??= "http://localhost:3001";
process.env.AUTH_INTERNAL_TOKEN_GATEWAY_SECRET ??= "secret";
process.env.SMTP_HOST ??= "localhost";
process.env.SMTP_USER ??= "smtp";
process.env.SMTP_PASSWORD ??= "smtp";
process.env.TURNSTILE_SECRET ??= "turnstile";
process.env.MEILI_HOST ??= "http://localhost:7700";
process.env.MEILI_MASTER_KEY ??= "masterKey";
process.env.NOTIFY_BASE_URL ??= "http://localhost:3010";
process.env.NOTIFY_INTERNAL_SECRET ??= "notify";
process.env.REACTION_BASE_URL ??= "http://localhost:3011";
process.env.REACTION_INTERNAL_SECRET ??= "reaction";

mock.module("./search-client", () => ({
  searchClient: {
    meili: {},
  },
}));

function healthyMeili(overrides?: {
  indexes?: Array<{ uid: string; primaryKey?: string | null }>;
  settings?: Record<string, unknown>;
  tasks?: unknown;
}) {
  return {
    health: mock(async () => ({ status: "available" })),
    getVersion: mock(async () => ({ pkgVersion: "1.12.0" })),
    getStats: mock(async () => ({
      indexes: {
        content: {
          numberOfDocuments: 42,
          isIndexing: false,
          lastUpdate: "2026-05-25T00:00:00.000Z",
          fieldDistribution: { type: 12 },
        },
      },
    })),
    getIndexes: mock(async () => ({
      results: overrides?.indexes ?? [{ uid: "content", primaryKey: "id" }],
    })),
    getTasks: mock(async () => overrides?.tasks ?? { results: [] }),
    index: mock((uid: string) => {
      const schema = EXPECTED_MEILI_INDEX_SCHEMAS.find(
        (entry) => entry.uid === uid,
      );
      const settings = overrides?.settings ?? {
        searchableAttributes: schema?.searchableAttributes ?? [],
        filterableAttributes: schema?.filterableAttributes ?? [],
        sortableAttributes: schema?.sortableAttributes ?? [],
      };
      return {
        getSettings: mock(async () => settings),
        getRawInfo: mock(async () => ({ primaryKey: "id" })),
      };
    }),
  };
}

describe("getMeiliStatusSummary", () => {
  test("returns healthy summary with expected schemas and live stats", async () => {
    const { getMeiliStatusSummary } = await import("./status.service");
    const summary = await getMeiliStatusSummary({
      meili: healthyMeili({
        indexes: EXPECTED_MEILI_INDEX_SCHEMAS.map((schema) => ({
          uid: schema.uid,
          primaryKey: schema.primaryKey,
        })),
      }),
    });

    expect(summary.status).toBe("available");
    expect(summary.version).toBe("1.12.0");
    expect(summary.schemas.map((schema) => schema.uid)).toContain("content");
    expect(
      summary.indexes.find((index) => index.uid === "content"),
    ).toMatchObject({
      exists: true,
      numberOfDocuments: 42,
      summaryFields: { type: 12, postKind: null, visibility: null },
    });
  });

  test("normalizes unavailable Meili without leaking connection details", async () => {
    const { getMeiliStatusSummary } = await import("./status.service");
    const summary = await getMeiliStatusSummary({
      meili: {
        health: mock(async () => {
          throw new Error(
            "connect ECONNREFUSED http://localhost:7700?key=secret",
          );
        }),
      },
    });

    expect(summary.status).toBe("unavailable");
    expect(summary.reason).toBe("Meilisearch check failed");
    expect(JSON.stringify(summary)).not.toContain("secret");
  });

  test("reports missing indexes and settings drift as degraded", async () => {
    const { getMeiliStatusSummary } = await import("./status.service");
    const summary = await getMeiliStatusSummary({
      meili: healthyMeili({
        indexes: [{ uid: "content", primaryKey: "id" }],
        settings: {
          searchableAttributes: ["titles"],
          filterableAttributes: ["type"],
          sortableAttributes: ["createdAt"],
        },
      }),
    });

    expect(summary.status).toBe("degraded");
    expect(
      summary.indexes.find((index) => index.uid === "feedbacks"),
    ).toMatchObject({ exists: false, status: "degraded" });
    const content = summary.indexes.find((index) => index.uid === "content");
    expect(content?.settingsDrift?.filterableAttributes.missing).toContain(
      "postKind",
    );
  });

  test("failed recent task degrades the summary", async () => {
    const { getMeiliStatusSummary } = await import("./status.service");
    const summary = await getMeiliStatusSummary({
      meili: healthyMeili({
        indexes: EXPECTED_MEILI_INDEX_SCHEMAS.map((schema) => ({
          uid: schema.uid,
          primaryKey: schema.primaryKey,
        })),
        tasks: {
          results: [
            {
              uid: 10,
              indexUid: "content",
              status: "failed",
              type: "documentAdditionOrUpdate",
              error: { code: "invalid_document", message: "bad document" },
            },
          ],
        },
      }),
    });

    expect(summary.status).toBe("degraded");
    expect(summary.tasks[0]).toMatchObject({
      uid: 10,
      indexUid: "content",
      errorCode: "invalid_document",
    });
  });
});
