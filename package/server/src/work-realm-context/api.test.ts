import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const currentIdentity = {
  userId: "user-1",
  permission: { role: "USER" },
};

const createMock = mock(async () => ({
  id: "context-1",
  workUnitId: "work-1",
  realmUnitId: "realm-1",
  role: "official",
  priority: 0,
  locale: null,
  releaseUnitId: null,
  createdByUserId: "user-1",
  updatedByUserId: "user-1",
  createdAt: new Date("2026-05-28T00:00:00.000Z"),
  updatedAt: new Date("2026-05-28T00:00:00.000Z"),
}));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  isAdminRole: mock(() => false),
  verifyAdminFromDb: mock(async () => false),
}));

mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    status: number;
    code?: string;

    constructor(status: number, message: string, options?: { code?: string }) {
      super(message);
      this.status = status;
      this.code = options?.code;
    }
  },
}));

mock.module("./service", () => ({
  workRealmContextService: {
    list: mock(async () => []),
    getById: mock(async () => null),
    resolveForRelease: mock(async () => ({
      releaseUnitId: "release-1",
      workUnitId: null,
      official: null,
      community: [],
      language: [],
      archive: [],
      conflicts: [],
    })),
    create: createMock,
    update: mock(async () => null),
    delete: mock(async () => undefined),
  },
}));

const { workRealmContextApi } = await import("./api");

describe("workRealmContextApi", () => {
  test("forbids ordinary users from creating official work realm contexts", async () => {
    const app = new Elysia()
      .use(workRealmContextApi)
      .onError(({ error, set }) => {
        const status = (error as { status?: number }).status ?? 500;
        set.status = status;
        return {
          message: error.message,
          code: (error as { code?: string }).code,
        };
      });

    const response = await app.handle(
      new Request("http://localhost/work-realm-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workUnitId: "work-1",
          realmUnitId: "realm-1",
          role: "official",
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toContain(
      "Forbidden: work realm context management required",
    );
    expect(createMock).not.toHaveBeenCalled();
  });
});
