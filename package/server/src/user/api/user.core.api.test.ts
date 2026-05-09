import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({
      identity: { userId: "actor-user", permission: { role: "MEMBER" } },
    }),
  }),
  verifyAdminFromDb: async () => false,
}));

mock.module("@/meili/mapper", () => ({
  mapUserSearchDocToPublicProfile: (user: unknown) => user,
}));

mock.module("@/meili/meili.service", () => ({
  meiliService: {
    searchUsers: async () => ({ users: [], total: 0 }),
  },
}));

const userStub = {
  userId: "user-1",
  slug: "alice01",
  name: "Alice",
};

mock.module("../models/mapper", () => ({
  mapUserToDTO: (user: unknown) => user,
}));

mock.module("../service/user.service", () => ({
  userService: {
    getBySlug: async (userSlug: string) =>
      userSlug === "alice01" ? userStub : null,
    getByUserId: async (userId: string) => {
      if (userId === "user-1") return userStub;
      throw { code: "P2025" };
    },
    update: async () => userStub,
    delete: async () => undefined,
  },
}));

describe("GET /user/by-slug/:userSlug", () => {
  test("returns user profile from the user slug namespace", async () => {
    const { coreRoute } = await import("./user.core.api");
    const res = await coreRoute.handle(
      new Request("http://localhost/by-slug/alice01"),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(userStub);
  });

  test("returns 404 when user slug does not exist", async () => {
    const { coreRoute } = await import("./user.core.api");
    const res = await coreRoute.handle(
      new Request("http://localhost/by-slug/missing-user"),
    );

    expect(res.status).toBe(404);
  });
});

describe("GET /user/:userId", () => {
  test("returns user profile from the userId namespace", async () => {
    const { coreRoute } = await import("./user.core.api");
    const res = await coreRoute.handle(new Request("http://localhost/user-1"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(userStub);
  });

  test("returns 404 when userId does not exist", async () => {
    const { coreRoute } = await import("./user.core.api");
    const res = await coreRoute.handle(new Request("http://localhost/missing"));

    expect(res.status).toBe(404);
  });
});
