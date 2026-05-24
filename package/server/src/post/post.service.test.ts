import { describe, expect, mock, test } from "bun:test";
import {
  collectEditorialPatchLeafPaths,
  isEditorialPathInScope,
  markdownContentDoc,
} from "@rezics/contract";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const unitCreateMock = mock(async (): Promise<any> => ({ id: "post-1" }));
const unitFindUniqueMock = mock(async (): Promise<any> => null);
const unitFindUniqueOrThrowMock = mock(
  async (): Promise<any> => ({ id: "post-1", userId: "wiki-owner" }),
);
const unitFindManyMock = mock(
  async (args: any): Promise<any> =>
    (args.where.id.in as string[]).map((id) => ({ id })),
);
const postCreateMock = mock(
  async (_args?: any): Promise<any> => ({ unitId: "post-1" }),
);
const postUpdateMock = mock(
  async (_args?: any): Promise<any> => ({ unitId: "post-1" }),
);
const postFindManyMock = mock(async (): Promise<any[]> => []);
const postCountMock = mock(async () => 0);
const postFindUniqueMock = mock(async (): Promise<any> => null);
const postFindUniqueOrThrowMock = mock(
  async (): Promise<any> => ({
    unitId: "parent-1",
    rootPostUnitId: "root-1",
    depth: 0,
    sortPath: "0001",
    isLocked: false,
    rootTargetUnitId: null,
    rootTargetUnitType: null,
  }),
);
const postFindFirstMock = mock(async () => null);
const realmUnitCreateMock = mock(async (args: any) => {
  if (args.data.realmUnitId === "missing-realm") {
    throw new Error("Foreign key failed");
  }
  return args.data;
});
const unitTagCreateMock = mock(async (args: any) => args.data);
const unitTagFindManyMock = mock(async (): Promise<any[]> => []);
const unitTranslationFindManyMock = mock(async (): Promise<any[]> => []);
const bookFindUniqueMock = mock(async (): Promise<any> => null);
const entityFindUniqueMock = mock(async (): Promise<any> => null);
const creditAttributionFindManyMock = mock(async (): Promise<any[]> => []);
const subjectAttributionFindManyMock = mock(async (): Promise<any[]> => []);
const unitCollaboratorFindUniqueMock = mock(async (): Promise<any> => null);
const unitFieldLockFindManyMock = mock(async (): Promise<any[]> => []);
const queryRawMock = mock(async (): Promise<any[]> => [{ sequence: 1n }]);
const historyOutboxCreateMock = mock(async (args: any) => args.data);
const userFindUniqueMock = mock(async () => null);
const transactionMock = mock(async (fn: any) =>
  fn({
    $queryRaw: queryRawMock,
    unit: {
      create: unitCreateMock,
      findMany: unitFindManyMock,
      findUniqueOrThrow: unitFindUniqueOrThrowMock,
    },
    post: {
      create: postCreateMock,
      update: postUpdateMock,
      findUniqueOrThrow: postFindUniqueOrThrowMock,
      findFirst: postFindFirstMock,
    },
    realmUnit: { create: realmUnitCreateMock },
    unitTag: { create: unitTagCreateMock, findMany: unitTagFindManyMock },
    unitTranslation: { findMany: unitTranslationFindManyMock },
    book: { findUnique: bookFindUniqueMock },
    entity: { findUnique: entityFindUniqueMock },
    creditAttribution: { findMany: creditAttributionFindManyMock },
    subjectAttribution: { findMany: subjectAttributionFindManyMock },
    unitCollaborator: { findUnique: unitCollaboratorFindUniqueMock },
    unitFieldLock: { findMany: unitFieldLockFindManyMock },
    historyOutbox: { create: historyOutboxCreateMock },
  }),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  $transaction: transactionMock,
  unit: {
    create: unitCreateMock,
    findMany: unitFindManyMock,
    findUnique: unitFindUniqueMock,
    findUniqueOrThrow: unitFindUniqueOrThrowMock,
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
  unitTag: { create: unitTagCreateMock, findMany: unitTagFindManyMock },
  user: { findUnique: userFindUniqueMock },
});

mock.module("@/infra/infra-users", () => ({
  resolveRezicsWikiUserId: mock(async () => "wiki-owner"),
}));

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

mock.module("@/meili/content/sync", () => ({
  deleteContentFromMeili: mock(async () => undefined),
  patchContentContainedUnitIdsToMeili: mock(async () => undefined),
  patchContentCreditsToMeili: mock(async () => undefined),
  patchContentMetadataToMeili: mock(async () => undefined),
  patchContentRealmIdsToMeili: mock(async () => undefined),
  patchContentRealmTagKeysToMeili: mock(async () => undefined),
  patchContentSubjectsToMeili: mock(async () => undefined),
  patchContentTagsToMeili: mock(async () => undefined),
  patchContentTranslationsToMeili: mock(async () => undefined),
  syncContentToMeili: mock(async () => undefined),
}));

mock.module("@/utils/sanitizeUser", () => ({
  publicUserSelect: {},
}));

const { PostService } = await import("./post.service");

const content = (source: string) => markdownContentDoc(source);

function resetMocks() {
  unitCreateMock.mockClear();
  unitFindUniqueMock.mockClear();
  unitFindUniqueOrThrowMock.mockClear();
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
  unitTagFindManyMock.mockClear();
  unitTranslationFindManyMock.mockClear();
  bookFindUniqueMock.mockClear();
  entityFindUniqueMock.mockClear();
  creditAttributionFindManyMock.mockClear();
  subjectAttributionFindManyMock.mockClear();
  unitCollaboratorFindUniqueMock.mockClear();
  unitFieldLockFindManyMock.mockClear();
  queryRawMock.mockClear();
  historyOutboxCreateMock.mockClear();
  userFindUniqueMock.mockClear();
  transactionMock.mockClear();
}

function firstPostFindManyArgs() {
  return (postFindManyMock.mock.calls as any[])[0]?.[0] as any;
}

describe("PostService.create realm/tag junction writes", () => {
  const service = new PostService();

  test("creates a post with no realm or tags", async () => {
    resetMocks();

    await service.create({ content: content("hello") }, "user-1");

    expect(realmUnitCreateMock).not.toHaveBeenCalled();
    expect(unitTagCreateMock).not.toHaveBeenCalled();
    expect(historyOutboxCreateMock).not.toHaveBeenCalled();
  });

  test("creates RealmUnit rows for one realm", async () => {
    resetMocks();

    await service.create(
      { content: content("hello"), realmUnitIds: ["realm-1"] },
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
      {
        content: content("hello"),
        realmUnitIds: ["realm-1", "realm-2", "realm-3"],
      },
      "user-1",
    );

    expect(
      realmUnitCreateMock.mock.calls.map((call) => call[0].data.realmUnitId),
    ).toEqual(["realm-1", "realm-2", "realm-3"]);
  });

  test("creates UnitTag rows for tags", async () => {
    resetMocks();

    await service.create(
      { content: content("hello"), tagIds: ["tag-1", "tag-2"] },
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
      {
        content: content("hello"),
        realmUnitIds: ["realm-1"],
        tagIds: ["tag-1"],
      },
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
        { content: content("hello"), tagIds: ["tag-1", "missing-tag"] },
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
        {
          content: content("hello"),
          realmUnitIds: ["realm-1", "missing-realm"],
        },
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

  test("tag filter uses RealmTagApplication OR UnitTag fallback semantics", async () => {
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

describe("PostService.list subtree queries", () => {
  const service = new PostService();

  test("queries descendants by anchor sortPath and relative maxDepth", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "reply-2",
      rootPostUnitId: "root-1",
      depth: 2,
      sortPath: "0001.0002",
    });

    await service.list({
      subtreeRootPostUnitId: "reply-2",
      mode: "threaded",
      maxDepth: 2,
    });

    expect(postFindUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { unitId: "reply-2" },
      select: {
        unitId: true,
        rootPostUnitId: true,
        depth: true,
        sortPath: true,
      },
    });
    expect(firstPostFindManyArgs().where).toMatchObject({
      OR: [
        { unit: { status: "PUBLISHED", visibility: "PUBLIC" } },
        { unit: { status: "DELETED", visibility: "PUBLIC" } },
      ],
      rootPostUnitId: "root-1",
      unitId: { not: "reply-2" },
      depth: { lte: 4 },
      sortPath: { startsWith: "0001.0002." },
    });
    expect(firstPostFindManyArgs().orderBy).toEqual([
      { sortPath: "asc" },
      { createdAt: "asc" },
    ]);
  });

  test("allows root anchor without sortPath by querying the whole root thread", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "root-1",
      rootPostUnitId: "root-1",
      depth: 0,
      sortPath: null,
    });

    await service.list({
      subtreeRootPostUnitId: "root-1",
      mode: "threaded",
      maxDepth: 3,
    });

    expect(firstPostFindManyArgs().where).toMatchObject({
      OR: [
        { unit: { status: "PUBLISHED", visibility: "PUBLIC" } },
        { unit: { status: "DELETED", visibility: "PUBLIC" } },
      ],
      rootPostUnitId: "root-1",
      unitId: { not: "root-1" },
      depth: { lte: 3 },
    });
    expect(firstPostFindManyArgs().where.sortPath).toBeUndefined();
  });
});

describe("PostService.create rootTargetUnit derivation", () => {
  const service = new PostService();

  function createDataArg() {
    return (postCreateMock.mock.calls as any[])[0]?.[0]?.data as any;
  }

  test("top-level REVIEW carries its own targetUnitId as rootTargetUnitId with type from Unit", async () => {
    resetMocks();
    unitFindUniqueMock.mockResolvedValueOnce({ type: "BOOK" });

    await service.create(
      { content: content("great"), kind: "REVIEW", targetUnitId: "book-B" },
      "user-1",
    );

    expect(unitFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "book-B" },
      select: { type: true },
    });
    const data = createDataArg();
    expect(data.targetUnitId).toBe("book-B");
    expect(data.rootTargetUnitId).toBe("book-B");
    expect(data.rootTargetUnitType).toBe("BOOK");
  });

  test("top-level REMARK with game target derives GAME type", async () => {
    resetMocks();
    unitFindUniqueMock.mockResolvedValueOnce({ type: "GAME" });

    await service.create(
      { content: content("thoughts"), kind: "REMARK", targetUnitId: "game-G" },
      "user-1",
    );

    const data = createDataArg();
    expect(data.rootTargetUnitId).toBe("game-G");
    expect(data.rootTargetUnitType).toBe("GAME");
  });

  test("top-level POST with no targetUnitId leaves both fields undefined", async () => {
    resetMocks();

    await service.create({ content: content("free-form") }, "user-1");

    const data = createDataArg();
    expect(data.targetUnitId).toBeUndefined();
    expect(data.rootTargetUnitId).toBeUndefined();
    expect(data.rootTargetUnitType).toBeUndefined();
    // No Unit lookup needed when there is no target.
    expect(unitFindUniqueMock).not.toHaveBeenCalled();
  });

  test("reply inherits rootTargetUnit fields from parent without extra Unit lookup", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "parent-1",
      rootPostUnitId: "root-1",
      depth: 0,
      sortPath: "0001",
      isLocked: false,
      rootTargetUnitId: "book-B",
      rootTargetUnitType: "BOOK",
    });

    await service.create(
      { content: content("reply"), parentPostUnitId: "parent-1" },
      "user-1",
    );

    const data = createDataArg();
    expect(data.rootTargetUnitId).toBe("book-B");
    expect(data.rootTargetUnitType).toBe("BOOK");
    expect(unitFindUniqueMock).not.toHaveBeenCalled();
  });

  test("nested reply still inherits root target from its parent", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockResolvedValueOnce({
      unitId: "comment-1",
      rootPostUnitId: "root-1",
      depth: 1,
      sortPath: "0001.0001",
      isLocked: false,
      rootTargetUnitId: "book-B",
      rootTargetUnitType: "BOOK",
    });

    await service.create(
      { content: content("nested"), parentPostUnitId: "comment-1" },
      "user-1",
    );

    const data = createDataArg();
    expect(data.rootTargetUnitId).toBe("book-B");
    expect(data.rootTargetUnitType).toBe("BOOK");
  });

  test("CHAPTER kind reuses the Unit type read from the BOOK validation (single Unit lookup)", async () => {
    resetMocks();
    unitFindUniqueMock.mockResolvedValueOnce({ type: "BOOK" });

    await service.create(
      { content: content("ch1"), kind: "CHAPTER", targetUnitId: "book-B" },
      "user-1",
    );

    expect(unitFindUniqueMock).toHaveBeenCalledTimes(1);
    const data = createDataArg();
    expect(data.rootTargetUnitId).toBe("book-B");
    expect(data.rootTargetUnitType).toBe("BOOK");
  });
});

describe("PostService.update immutability", () => {
  const service = new PostService();

  test("update writes only content/isLocked/extra; rootTarget* fields are not in the update payload", async () => {
    resetMocks();
    const directPostUpdateMock = mock(async () => ({ unitId: "post-1" }));
    Object.assign(prismaMock.post, { update: directPostUpdateMock });

    await service.update("post-1", {
      content: content("edited"),
      isLocked: true,
    });

    expect(directPostUpdateMock).toHaveBeenCalledTimes(1);
    const args = (directPostUpdateMock.mock.calls as any[])[0]?.[0];
    expect(args.where).toEqual({ unitId: "post-1" });
    expect(args.data).toEqual({ content: content("edited"), isLocked: true });
    expect(args.data.targetUnitId).toBeUndefined();
    expect(args.data.rootTargetUnitId).toBeUndefined();
    expect(args.data.rootTargetUnitType).toBeUndefined();

    // Restore the shared mock so subsequent tests see the standard behavior.
    Object.assign(prismaMock.post, { update: postUpdateMock });
  });
});

describe("PostService wiki posts", () => {
  const service = new PostService();
  const actor = {
    userId: "actor-1",
    permission: { role: "USER" },
  } as any;

  test("wiki creation uses rezics-wiki ownership and records author", async () => {
    resetMocks();
    postCreateMock.mockImplementationOnce(async (args: any) => ({
      unitId: "wiki-post-1",
      content: args.data.content,
      kind: args.data.kind,
    }));
    postUpdateMock.mockImplementationOnce(async (args: any) => ({
      unitId: "wiki-post-1",
      content: content("body"),
      kind: "WIKI",
      rootPostUnitId: args.data.rootPostUnitId,
    }));

    await service.create({ kind: "WIKI", content: content("body") }, "actor-1");

    const unitCreateArgs = (unitCreateMock.mock.calls as any[])[0][0];
    const postCreateArgs = (postCreateMock.mock.calls as any[])[0][0];
    expect(unitCreateArgs.data.userId).toBe("wiki-owner");
    expect(postCreateArgs.data.authorUserId).toBe("actor-1");
    expect(postCreateArgs.data.kind).toBe("WIKI");
    expect(historyOutboxCreateMock).toHaveBeenCalledTimes(1);
    const patch =
      historyOutboxCreateMock.mock.calls[0]?.[0].data.payload.revision.patch;
    expect(
      collectEditorialPatchLeafPaths(patch).every((path) =>
        isEditorialPathInScope("wiki-post", path),
      ),
    ).toBe(true);
  });

  test("unlocked wiki content edit writes through collaborative authority", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
    }));

    await service.update("wiki-post-1", { content: content("edited") }, actor);

    expect(unitFieldLockFindManyMock).toHaveBeenCalledTimes(1);
    expect(postUpdateMock).toHaveBeenCalledTimes(1);
    expect(historyOutboxCreateMock).toHaveBeenCalledTimes(1);
  });

  test("wiki content source patch uses path-based lock and history", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
      content: content("original"),
    }));

    await service.update("wiki-post-1", { content: content("edited") }, actor, {
      patch: { post: { content: { main: { source: "edited" } } } },
      message: "wiki-post.content.source.update",
    });

    expect(unitFieldLockFindManyMock).toHaveBeenCalledTimes(1);
    expect(historyOutboxCreateMock).toHaveBeenCalledTimes(1);
    expect(
      historyOutboxCreateMock.mock.calls[0]?.[0].data.payload,
    ).toMatchObject({
      kind: "editorial_revision",
      revision: {
        unitId: "wiki-post-1",
        actorUserId: "actor-1",
        patch: { post: { content: { main: { source: "edited" } } } },
        message: "wiki-post.content.source.update",
      },
    });

    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
      content: content("original"),
    }));
    unitFieldLockFindManyMock.mockImplementationOnce(async () => [
      { path: "post.content.main.source" },
    ]);

    await expect(
      service.update("wiki-post-1", { content: content("edited") }, actor, {
        patch: { post: { content: { main: { source: "edited" } } } },
        message: "wiki-post.content.source.update",
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FIELD_LOCKED",
      details: {
        blockedPaths: ["post.content.main.source"],
        offendingLockPath: "post.content.main.source",
        offendingPatchPath: "post.content.main.source",
      },
    });
  });

  test("locked wiki content edit is rejected", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
    }));
    unitFieldLockFindManyMock.mockImplementationOnce(async () => [
      { path: "post.content.main" },
    ]);

    await expect(
      service.update("wiki-post-1", { content: content("edited") }, actor),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FIELD_LOCKED",
    });
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  test("ordinary review update does not query field locks", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "REVIEW",
    }));

    await service.update("review-1", { content: content("edited") }, actor);

    expect(unitFieldLockFindManyMock).not.toHaveBeenCalled();
    expect(historyOutboxCreateMock).not.toHaveBeenCalled();
  });

  test("Post.isLocked does not control wiki content locks", async () => {
    resetMocks();
    postFindUniqueOrThrowMock.mockImplementationOnce(async () => ({
      kind: "WIKI",
    }));

    await service.update(
      "wiki-post-1",
      { content: content("edited"), isLocked: true },
      actor,
    );

    expect(unitFieldLockFindManyMock).toHaveBeenCalledTimes(1);
    const postUpdateArgs = (postUpdateMock.mock.calls as any[])[0][0];
    expect(postUpdateArgs.data.isLocked).toBe(true);
  });
});
