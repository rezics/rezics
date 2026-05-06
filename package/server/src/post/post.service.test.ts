import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const unitCreateMock = mock(async () => ({ id: "post-1" }));
const unitFindUniqueMock = mock(async () => null);
const unitFindManyMock = mock(async (args: any) =>
  (args.where.id.in as string[]).map((id) => ({ id })),
);
const postCreateMock = mock(async () => ({ unitId: "post-1" }));
const postUpdateMock = mock(async () => ({ unitId: "post-1" }));
const postFindManyMock = mock(async () => []);
const postCountMock = mock(async () => 0);
const postFindUniqueMock = mock(async () => null);
const postFindUniqueOrThrowMock = mock(async () => ({
  unitId: "parent-1",
  rootPostUnitId: "root-1",
  depth: 0,
  sortPath: "0001",
  isLocked: false,
}));
const postFindFirstMock = mock(async () => null);
const realmUnitCreateMock = mock(async (args: any) => {
  if (args.data.realmUnitId === "missing-realm") {
    throw new Error("Foreign key failed");
  }
  return args.data;
});
const unitTagCreateMock = mock(async (args: any) => args.data);
const transactionMock = mock(async (fn: any) =>
  fn({
    unit: {
      create: unitCreateMock,
      findMany: unitFindManyMock,
    },
    post: {
      create: postCreateMock,
      update: postUpdateMock,
      findUniqueOrThrow: postFindUniqueOrThrowMock,
      findFirst: postFindFirstMock,
    },
    realmUnit: { create: realmUnitCreateMock },
    unitTag: { create: unitTagCreateMock },
  }),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: transactionMock,
  unit: {
    create: unitCreateMock,
    findMany: unitFindManyMock,
    findUnique: unitFindUniqueMock,
  },
  post: {
    create: postCreateMock,
    update: postUpdateMock,
    findMany: postFindManyMock,
    count: postCountMock,
    findUnique: postFindUniqueMock,
    findUniqueOrThrow: postFindUniqueOrThrowMock,
    findFirst: postFindFirstMock,
  },
  realmUnit: { create: realmUnitCreateMock },
  unitTag: { create: unitTagCreateMock },
});

mock.module("@/meili/post/sync", () => ({
  deletePostFromMeili: mock(async () => undefined),
  patchPostFieldsToMeili: mock(async () => undefined),
  patchPostsAuthorToMeili: mock(async () => undefined),
  patchPostsTargetToMeili: mock(async () => undefined),
  syncAllPostsToMeili: mock(async () => undefined),
  syncPostToMeili: mock(async () => undefined),
  syncPostsByAuthorToMeili: mock(async () => undefined),
  syncPostsByTargetToMeili: mock(async () => undefined),
}));

mock.module("@/utils/sanitizeUser", () => ({
  publicUserSelect: {},
}));

const { PostService } = await import("./post.service");

function resetMocks() {
  unitCreateMock.mockClear();
  unitFindUniqueMock.mockClear();
  unitFindManyMock.mockClear();
  unitFindManyMock.mockImplementation(async (args: any) =>
    (args.where.id.in as string[]).map((id) => ({ id })),
  );
  postCreateMock.mockClear();
  postUpdateMock.mockClear();
  postFindManyMock.mockClear();
  postCountMock.mockClear();
  postFindUniqueMock.mockClear();
  postFindUniqueOrThrowMock.mockClear();
  postFindFirstMock.mockClear();
  realmUnitCreateMock.mockClear();
  unitTagCreateMock.mockClear();
  transactionMock.mockClear();
}

function firstPostFindManyArgs() {
  return (postFindManyMock.mock.calls as any[])[0]?.[0] as any;
}

describe("PostService.create realm/tag junction writes", () => {
  const service = new PostService();

  test("creates a post with no realm or tags", async () => {
    resetMocks();

    await service.create({ body: "hello" }, "user-1");

    expect(realmUnitCreateMock).not.toHaveBeenCalled();
    expect(unitTagCreateMock).not.toHaveBeenCalled();
  });

  test("creates RealmUnit rows for one realm", async () => {
    resetMocks();

    await service.create(
      { body: "hello", realmUnitIds: ["realm-1"] },
      "user-1",
    );

    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
    expect(realmUnitCreateMock.mock.calls[0]?.[0].data).toMatchObject({
      realmUnitId: "realm-1",
      unitId: "post-1",
    });
  });

  test("creates RealmUnit rows for three realms", async () => {
    resetMocks();

    await service.create(
      { body: "hello", realmUnitIds: ["realm-1", "realm-2", "realm-3"] },
      "user-1",
    );

    expect(
      realmUnitCreateMock.mock.calls.map((call) => call[0].data.realmUnitId),
    ).toEqual(["realm-1", "realm-2", "realm-3"]);
  });

  test("creates UnitTag rows for tags", async () => {
    resetMocks();

    await service.create(
      { body: "hello", tagIds: ["tag-1", "tag-2"] },
      "user-1",
    );

    expect(unitFindManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ["tag-1", "tag-2"] },
        type: "TAG",
        status: { not: "DELETED" },
      },
      select: { id: true },
    });
    expect(unitTagCreateMock.mock.calls.map((call) => call[0].data)).toEqual([
      { unitId: "post-1", tagUnitId: "tag-1" },
      { unitId: "post-1", tagUnitId: "tag-2" },
    ]);
  });

  test("creates RealmUnit and UnitTag rows in the same transaction", async () => {
    resetMocks();

    await service.create(
      { body: "hello", realmUnitIds: ["realm-1"], tagIds: ["tag-1"] },
      "user-1",
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(realmUnitCreateMock).toHaveBeenCalledTimes(1);
    expect(unitTagCreateMock).toHaveBeenCalledTimes(1);
  });

  test("rejects invalid tag ids with 400", async () => {
    resetMocks();
    unitFindManyMock.mockResolvedValueOnce([{ id: "tag-1" }]);

    await expect(
      service.create(
        { body: "hello", tagIds: ["tag-1", "missing-tag"] },
        "user-1",
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid tagIds: missing-tag",
    });
    expect(unitTagCreateMock).not.toHaveBeenCalled();
  });

  test("rejects when a realm insert fails", async () => {
    resetMocks();

    await expect(
      service.create(
        { body: "hello", realmUnitIds: ["realm-1", "missing-realm"] },
        "user-1",
      ),
    ).rejects.toThrow("Foreign key failed");
  });
});

describe("PostService.byRealm", () => {
  const service = new PostService();

  test("filters through RealmUnit and returns empty result", async () => {
    resetMocks();
    postFindManyMock.mockResolvedValueOnce([]);
    postCountMock.mockResolvedValueOnce(0);

    const result = await service.byRealm("realm-1");

    expect(result).toEqual({ posts: [], total: 0 });
    expect(firstPostFindManyArgs().where.unit.inRealms).toEqual({
      some: { realmUnitId: "realm-1" },
    });
  });

  test("new sort orders by createdAt descending", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "new" });

    expect(firstPostFindManyArgs().orderBy).toEqual([{ createdAt: "desc" }]);
  });

  test("top sort orders by ScoreEntry value descending", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "top" });

    expect(firstPostFindManyArgs().orderBy).toEqual([
      { scoreEntry: { value: "desc" } },
      { createdAt: "desc" },
    ]);
  });

  test("hot sort applies seven-day window and top ordering", async () => {
    resetMocks();
    await service.byRealm("realm-1", { sort: "hot" });

    const args = firstPostFindManyArgs();
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual([
      { scoreEntry: { value: "desc" } },
      { createdAt: "desc" },
    ]);
  });

  test("tag filter uses RealmTagUnit OR UnitTag fallback semantics", async () => {
    resetMocks();
    await service.byRealm("realm-1", { tagIds: ["tag-1", "tag-2"] });

    expect(firstPostFindManyArgs().where.unit.OR).toEqual([
      {
        realmTagApplicationsAsTargetUnit: {
          some: {
            realmUnitId: "realm-1",
            tagUnitId: { in: ["tag-1", "tag-2"] },
          },
        },
      },
      {
        AND: [
          {
            realmTagApplicationsAsTargetUnit: {
              none: { realmUnitId: "realm-1" },
            },
          },
          {
            unitTags: {
              some: { tagUnitId: { in: ["tag-1", "tag-2"] } },
            },
          },
        ],
      },
    ]);
  });

  test("pagination passes start and limit through", async () => {
    resetMocks();
    await service.byRealm("realm-1", { start: 10, limit: 5 });

    const args = firstPostFindManyArgs();
    expect(args.skip).toBe(10);
    expect(args.take).toBe(5);
  });
});
