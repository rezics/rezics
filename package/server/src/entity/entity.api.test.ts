import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";
import { AppError } from "../utils/errors";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

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

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: async () => ({ status: "created" }),
  },
}));

mock.module("@/unit/collaborative-metadata", async () => {
  const actual = await import(
    "../unit/collaborative-metadata.ts?entity-api-test-actual"
  );

  return {
    ...actual,
    assertEditorialPatchAllowed: (patch: Record<string, unknown>) => {
      if (patch.realmTagApplications) {
        throw new AppError(400, "Externally governed patch path", {
          details: {
            offendingPath: "realmTagApplications.featured",
            useApi: "/realm-tag-application",
          },
        });
      }
    },
  };
});

const entityServiceMock = {
  getBySlug: mock(async () => entityRow()),
  getByUnitId: mock(async () => entityRow()),
  list: mock(async () => ({ rows: [entityRow()], total: 1 })),
  create: mock(async () => entityRow()),
  update: mock(async () => entityRow()),
  delete: mock(async () => undefined),
};

mock.module("./entity.service", () => ({
  entityService: entityServiceMock,
}));

async function makeApp() {
  const { entityApi } = await import("./entity.api");
  return new Elysia()
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return {
          message: error.message,
          ...(error.details ? { detail: error.details } : {}),
        };
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
    avatar: "https://cdn.example/entity.png",
    verified: false,
    eligibleCreditRoles: ["author"],
    eligibleSubjectRoles: ["about"],
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
          sourceUnitId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  };
}

function resetEntityService() {
  entityServiceMock.getBySlug.mockReset();
  entityServiceMock.getBySlug.mockResolvedValue(entityRow());
  entityServiceMock.getByUnitId.mockReset();
  entityServiceMock.getByUnitId.mockResolvedValue(entityRow());
  entityServiceMock.list.mockReset();
  entityServiceMock.list.mockResolvedValue({ rows: [entityRow()], total: 1 });
  entityServiceMock.create.mockReset();
  entityServiceMock.create.mockImplementation(async (input: any, ctx: any) => {
    if (!ctx?.isAdmin && input?.slug) {
      throw new AppError(403, "entity_slug_admin_only");
    }
    return entityRow();
  });
  entityServiceMock.update.mockReset();
  entityServiceMock.update.mockResolvedValue(entityRow());
  entityServiceMock.delete.mockReset();
  entityServiceMock.delete.mockResolvedValue(undefined);
}

describe("GET /entity/by-slug/:slug", () => {
  test("returns 200 when slug resolves", async () => {
    resetEntityService();
    const app = await makeApp();
    const res = await app.handle(
      new Request("http://localhost/entity/by-slug/liu-cixin"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { unitId: string };
    expect(body.unitId).toBe("entity-1");
  });

  test("returns 404 for unknown slug", async () => {
    resetEntityService();
    entityServiceMock.getBySlug.mockResolvedValueOnce(null);
    const app = await makeApp();
    const res = await app.handle(
      new Request("http://localhost/entity/by-slug/does-not-exist"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /entity/:unitId", () => {
  test("returns the DTO when the unit exists", async () => {
    resetEntityService();
    const app = await makeApp();
    const res = await app.handle(
      new Request(
        "http://localhost/entity/01234567-89ab-7def-9234-0123456789ab",
      ),
    );
    expect(res.status).toBe(200);
  });

  test("returns 404 when the unit is missing", async () => {
    resetEntityService();
    entityServiceMock.getByUnitId.mockResolvedValueOnce(null);
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
    resetEntityService();
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
    resetEntityService();
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
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
          translations: [{ language: "en", title: "X" }],
        }),
      }),
    );
    expect(res.status).toBe(403);
  });

  test("rejects unregistered kind before service writes", async () => {
    resetEntityService();
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
          kind: "made_up_kind",
          eligibleCreditRoles: ["author"],
          eligibleSubjectRoles: ["about"],
          translations: [{ language: "en", title: "X" }],
        }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(entityServiceMock.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /entity/:unitId editorial governance", () => {
  test("rejects externally governed paths with API hint", async () => {
    resetEntityService();
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
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            patch: { realmTagApplications: { featured: true } },
          }),
        },
      ),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      detail?: { offendingPath?: string; useApi?: string };
    };
    expect(body.detail).toMatchObject({
      offendingPath: "realmTagApplications.featured",
      useApi: "/realm-tag-application",
    });
    expect(entityServiceMock.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /entity/:unitId", () => {
  test("non-admin returns 403", async () => {
    resetEntityService();
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
    resetEntityService();
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
