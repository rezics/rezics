import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/shelf/system-shelves", () => ({
  bootstrapSystemShelves: mock(async () => undefined),
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
  bio: "Bio",
  description: null,
  joinDate: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  enqueueMock.mockClear();
  Object.assign(prismaMock, {
    $transaction: mock(async (cb: any) =>
      cb({
        unit: {
          upsert: mock(async () => ({})),
        },
        user: {
          create: mock(async () => userRow),
          findUnique: mock(async () => null),
          update: mock(async () => userRow),
        },
        emailVerificationContract: {
          upsert: mock(async () => ({})),
        },
        realmMember: {
          create: mock(async () => ({})),
        },
      }),
    ),
    unit: {
      findUnique: mock(async () => ({ slug: "alice" })),
      findMany: mock(async () => []),
    },
    user: {
      update: mock(async () => userRow),
      delete: mock(async () => ({})),
      count: mock(async () => 1),
    },
  });
});

describe("UserService search jobs", () => {
  test("update enqueues user field patch and posts-author fanout", async () => {
    const { userService } = await import("./user.service");

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
    const { userService } = await import("./user.service");

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
