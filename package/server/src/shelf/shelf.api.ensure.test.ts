import { beforeEach, describe, expect, mock, test } from "bun:test";
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
} | null = {
  sub: "alice",
  userId: "alice",
  permission: { role: "USER" },
};

mock.module("@/utils/errors", () => ({
  AppError,
}));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => {
      if (!currentIdentity) {
        throw new AppError(401, "Unauthorized");
      }
      return { identity: currentIdentity };
    },
  }),
  tryResolveIdentity: async () => currentIdentity,
  isAdminRole: () => false,
  verifyAdminFromDb: async () => false,
  verifyRootFromDb: async () => false,
}));

mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: () => "user-scope",
  requireSlugScopeId: () => "user-scope",
  pickSlugScope: () => "user-scope",
}));

mock.module("@/unit/unit.service", () => ({
  unitService: {},
}));

mock.module("./shelf.service", () => ({
  shelfService: {
    listUserShelves: async () => [],
    list: mock(async () => ({ shelves: [], total: 0 })),
  },
}));

const userGetByUserIdMock = mock(async (userId: string) => ({
  unitId: userId,
  slug: "alice",
}));

mock.module("@/user/service/user.service", () => ({
  userService: {
    getByUserId: userGetByUserIdMock,
    getBySlug: async () => null,
  },
}));

const ensureSystemShelfMock = mock(async () => ({
  unitId: "alice-favorites-shelf",
  created: true,
}));

mock.module("./system-shelves", async () => {
  const actual = await import("./system-shelves.ts?shelf-api-test-actual");
  return {
    ...actual,
    ensureSystemShelf: ensureSystemShelfMock,
  };
});

async function makeApp() {
  const { shelfApi } = await import("./shelf.api");
  return new Elysia()
    .onError(({ code, error, set }) => {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return {
          status: error.statusCode,
          code: error.code ?? code,
          message: error.message,
          ...(error.details ? { detail: error.details } : {}),
        };
      }
      set.status ||= 500;
      return {
        status: set.status,
        code,
        message: error instanceof Error ? error.message : "internal",
      };
    })
    .use(shelfApi);
}

function buildRequest(body: unknown) {
  return new Request("http://localhost/shelf/system/ensure", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  currentIdentity = {
    sub: "alice",
    userId: "alice",
    permission: { role: "USER" },
  };
  ensureSystemShelfMock.mockClear();
  ensureSystemShelfMock.mockResolvedValue({
    unitId: "alice-favorites-shelf",
    created: true,
  });
  userGetByUserIdMock.mockClear();
});

describe("POST /shelf/system/ensure", () => {
  test("returns 401 when unauthenticated", async () => {
    currentIdentity = null;
    const app = await makeApp();

    const res = await app.handle(buildRequest({ kindKey: "favorites" }));

    expect(res.status).toBe(401);
    expect(ensureSystemShelfMock).not.toHaveBeenCalled();
  });

  test("returns 200 with created: true when shelf was created", async () => {
    const app = await makeApp();

    const res = await app.handle(buildRequest({ kindKey: "favorites" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ unitId: "alice-favorites-shelf", created: true });
    expect(ensureSystemShelfMock).toHaveBeenCalledWith(
      "alice",
      "alice",
      "favorites",
    );
  });

  test("returns 200 with created: false on idempotent re-call", async () => {
    ensureSystemShelfMock.mockResolvedValueOnce({
      unitId: "existing-shelf",
      created: false,
    });
    const app = await makeApp();

    const res = await app.handle(buildRequest({ kindKey: "favorites" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ unitId: "existing-shelf", created: false });
  });

  test("returns 422 when kindKey is unknown", async () => {
    const app = await makeApp();

    const res = await app.handle(buildRequest({ kindKey: "custom_list" }));

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(ensureSystemShelfMock).not.toHaveBeenCalled();
  });

  test("returns 422 when body has auxiliary fields", async () => {
    const app = await makeApp();

    const res = await app.handle(
      buildRequest({ kindKey: "favorites", visibility: "PUBLIC" }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(ensureSystemShelfMock).not.toHaveBeenCalled();
  });
});

describe("GET/POST /shelf/list scope validation", () => {
  test("GET accepts exact containment filters", async () => {
    const app = await makeApp();

    const res = await app.handle(
      new Request(
        "http://localhost/shelf/list?containsUnitId=release-1&limit=20",
      ),
    );

    expect(res.status).toBe(200);
  });

  test("POST accepts exact containment filters", async () => {
    const app = await makeApp();

    const res = await app.handle(
      new Request("http://localhost/shelf/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          containsUnitId: "release-1",
          limit: 20,
        }),
      }),
    );

    expect(res.status).toBe(200);
  });
});
