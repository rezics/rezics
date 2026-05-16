import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";
import { AppError } from "@/utils/errors";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

installPrismaClientMock();

let currentIdentity: {
  sub: string;
  userId: string;
  permission: { role: string };
} = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let dbAdmin = false;

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  tryResolveIdentity: async () => currentIdentity,
  isAdminRole: (id: { permission?: { role?: string } } | null) =>
    id?.permission?.role === "ADMIN" || id?.permission?.role === "ROOT",
  verifyAdminFromDb: async () => dbAdmin,
  verifyRootFromDb: async () => false,
}));

mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: () => "entity-scope-unit-id",
  requireSlugScopeId: () => "entity-scope-unit-id",
  pickSlugScope: () => "entity-scope-unit-id",
}));

mock.module("@/meili/entity/sync", () => ({
  syncEntityToMeili: async () => {},
  deleteEntityFromMeili: async () => {},
  syncAllEntitiesToMeili: async () => ({ totalSynced: 0, message: "ok" }),
}));

async function makeApp() {
  const { entityApi } = await import("./entity.api");
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return { message: error.message };
      }
      set.status ||= 500;
      return {
        status: set.status,
        message: error instanceof Error ? error.message : "internal",
      };
    })
    .use(entityApi);
}

function nowDate() {
  return new Date("2026-05-16T00:00:00.000Z");
}

function entityRow(unitId = "entity-1", slug: string | null = null) {
  const now = nowDate();
  return {
    unitId,
    kind: "person",
    verified: false,
    unit: {
      id: unitId,
      type: "ENTITY",
      slug,
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
      translations: [
        {
          unitId,
          language: "en",
          title: "Liu Cixin",
          subtitle: null,
          summary: null,
          description: null,
          extra: null,
          sourceReleaseUnitId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  };
}

function resetPrisma() {
  const row = entityRow();
  const txClient = {
    unit: {
      create: mock(async () => ({ id: "entity-1" })),
      update: mock(async () => ({ id: "entity-1" })),
    },
    entity: {
      update: mock(async () => row),
      findUniqueOrThrow: mock(async () => row),
    },
    unitTranslation: {
      upsert: mock(async () => ({})),
    },
  };
  Object.assign(prismaMock, {
    $transaction: mock(async (cb: any) => cb(txClient)),
    entity: {
      findUnique: mock(async () => row),
      findUniqueOrThrow: mock(async () => row),
      findMany: mock(async () => [row]),
      count: mock(async () => 1),
    },
    unit: {
      findUnique: mock(async ({ where }: any) => {
        if (where?.slugScope_slug?.slug === "liu-cixin") {
          return { id: "entity-1", type: "ENTITY" };
        }
        return null;
      }),
      delete: mock(async () => ({ id: "entity-1" })),
    },
  });
}

describe("GET /entity/by-slug/:slug", () => {
  test("returns 200 when slug resolves", async () => {
    resetPrisma();
    const app = await makeApp();
    const res = await app.handle(
      new Request("http://localhost/entity/by-slug/liu-cixin"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { unitId: string };
    expect(body.unitId).toBe("entity-1");
  });

  test("returns 404 for unknown slug", async () => {
    resetPrisma();
    const app = await makeApp();
    const res = await app.handle(
      new Request("http://localhost/entity/by-slug/does-not-exist"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /entity/:unitId", () => {
  test("returns the DTO when the unit exists", async () => {
    resetPrisma();
    const app = await makeApp();
    const res = await app.handle(
      new Request(
        "http://localhost/entity/01234567-89ab-7def-9234-0123456789ab",
      ),
    );
    expect(res.status).toBe(200);
  });

  test("returns 404 when the unit is missing", async () => {
    resetPrisma();
    (prismaMock.entity.findUnique as any).mockImplementationOnce(
      async () => null,
    );
    const app = await makeApp();
    const res = await app.handle(
      new Request(
        "http://localhost/entity/01234567-89ab-7def-9234-0123456789ab",
      ),
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /entity body validation", () => {
  test("rejects a body that is missing translations", async () => {
    resetPrisma();
    currentIdentity = {
      sub: "user-1",
      userId: "user-1",
      permission: { role: "USER" },
    };
    dbAdmin = false;

    const app = await makeApp();
    const res = await app.handle(
      new Request("http://localhost/entity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "person" }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("non-admin: slug in payload is rejected with 403", async () => {
    resetPrisma();
    currentIdentity = {
      sub: "user-1",
      userId: "user-1",
      permission: { role: "USER" },
    };
    dbAdmin = false;

    const app = await makeApp();
    const res = await app.handle(
      new Request("http://localhost/entity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "person",
          slug: "test",
          translations: [{ language: "en", title: "X" }],
        }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("DELETE /entity/:unitId", () => {
  test("non-admin returns 403", async () => {
    resetPrisma();
    currentIdentity = {
      sub: "user-1",
      userId: "user-1",
      permission: { role: "USER" },
    };
    dbAdmin = false;
    const app = await makeApp();
    const res = await app.handle(
      new Request(
        "http://localhost/entity/01234567-89ab-7def-9234-0123456789ab",
        { method: "DELETE" },
      ),
    );
    expect(res.status).toBe(403);
  });

  test("admin via role claim returns 200", async () => {
    resetPrisma();
    currentIdentity = {
      sub: "admin-1",
      userId: "admin-1",
      permission: { role: "ADMIN" },
    };
    dbAdmin = false;
    const app = await makeApp();
    const res = await app.handle(
      new Request(
        "http://localhost/entity/01234567-89ab-7def-9234-0123456789ab",
        { method: "DELETE" },
      ),
    );
    expect(res.status).toBe(200);
  });
});
