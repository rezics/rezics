import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserRepository } from "./user.service";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/shelf/system-shelves", () => ({
  bootstrapSystemShelves: mock(async () => undefined),
  createDrizzleSystemShelfClient: mock(() => ({})),
}));

mock.module("@/infra/default-realm", () => ({
  getDefaultRealmId: () => null,
}));

mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: () => "user-scope-unit-id",
  pickSlugScope: () => "user-scope-unit-id",
  requireSlugScopeId: () => "user-scope-unit-id",
}));

const userRow = {
  unitId: "user-1",
  authUserId: null,
  email: null,
  name: "Alice",
  avatar: "https://cdn.example/a.png",
  summary: "Summary",
  description: null,
  joinDate: new Date("2026-01-01T00:00:00.000Z"),
  permission: null,
  followersCount: 0,
  followingsCount: 0,
  settings: null,
  extra: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  slug: "alice",
};

function createRepository(): UserRepository {
  return {
    list: mock(async () => ({ users: [], total: 0 })),
    getByUserId: mock(async () => userRow),
    getBySlug: mock(async () => userRow),
    create: mock(async () => userRow),
    materializeFromVerifiedAuth: mock(async () => userRow),
    completeProfileSetup: mock(async () => userRow),
    update: mock(async () => userRow),
    delete: mock(async () => undefined),
    exists: mock(async () => true),
    listFollowers: mock(async () => ({ users: [], total: 0 })),
    listFollowings: mock(async () => ({ users: [], total: 0 })),
    getCanonicalSlug: mock(async () => "alice"),
  };
}

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("UserService search jobs", () => {
  test("update enqueues user field patch and posts-author fanout", async () => {
    const { UserService } = await import("./user.service");
    const userService = new UserService(createRepository());

    await userService.update("user-1", {
      name: "Alice",
      avatar: "https://cdn.example/a.png",
    });

    expect(enqueueMock.mock.calls.map((call) => call[0].kind)).toEqual([
      "search.user.patchFields",
      "search.user.postsAuthorFanout",
    ]);
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      payload: {
        targetId: "user-1",
        fields: {
          name: "Alice",
          avatar: "https://cdn.example/a.png",
        },
      },
      source: { type: "server", service: "user" },
    });
  });

  test("delete enqueues user delete", async () => {
    const { UserService } = await import("./user.service");
    const userService = new UserService(createRepository());

    await userService.delete("user-1");

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.user.delete",
        payload: { userId: "user-1" },
        source: { type: "server", service: "user" },
      }),
    );
  });
});
