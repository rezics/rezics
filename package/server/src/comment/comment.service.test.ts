import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import type { CommentRepository, CommentService } from "./comment.service";
import type { CommentWithRelations } from "./comment.types";

const enqueueMock = mock(async () => ({ status: "created" }));
const searchCommentsMock = mock(async (_input: unknown) => ({
  items: [],
  total: 0,
  processingTimeMs: 1,
  query: "",
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

mock.module("@/block/block.service", () => ({
  blockService: {
    blockedUserIds: mock(async () => []),
  },
}));

mock.module("../meili/comment/comment.service", () => ({
  searchComments: searchCommentsMock,
}));

function commentRow(
  overrides: Partial<CommentWithRelations> = {},
): CommentWithRelations {
  return {
    id: "comment-1",
    rootUnitId: "root-1",
    realmUnitId: "realm-1",
    parentCommentId: null,
    authorUserId: "user-1",
    content: null,
    language: "en",
    depth: 1,
    replyCount: 0,
    directReplyCount: 0,
    lastReplyAt: null,
    isLocked: false,
    state: null,
    moderationStatus: "APPROVED",
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    author: null,
    ...overrides,
  };
}

function createRepositoryStub(
  overrides: Partial<CommentRepository> = {},
): CommentRepository {
  return {
    list: mock(async () => ({ comments: [], total: 0 })),
    getById: mock(async (id: string) => commentRow({ id })),
    getByIdsIncludingRedacted: mock(async (ids: string[]) =>
      ids.map((id) => commentRow({ id })),
    ),
    attachPinOverlays: mock(async (comments) => comments),
    getParentForCreate: mock(async (id: string) => ({
      id,
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      depth: 1,
      isLocked: false,
    })),
    getRealmContextForCreate: mock(async () => ({
      moderationStatus: "APPROVED" as const,
      isLocked: false,
    })),
    create: mock(async (input) =>
      commentRow({
        id: "comment-1",
        rootUnitId: input.rootUnitId,
        realmUnitId: input.realmUnitId,
        parentCommentId: input.parentCommentId ?? null,
        authorUserId: input.authorUserId,
        content: input.content,
        depth: input.depth,
      }),
    ),
    getUpdateIdentity: mock(async () => ({
      authorUserId: "user-1",
    })),
    update: mock(async (id: string, input) =>
      commentRow({ id, content: input.content ?? null }),
    ),
    getDeleteIdentity: mock(async () => ({ authorUserId: "user-1" })),
    softDelete: mock(async () => {}),
    ...overrides,
  };
}

async function createService(repository: CommentRepository) {
  const module = await import("./comment.service");
  return new module.CommentService(repository) as CommentService;
}

describe("CommentService", () => {
  test("search-backed repository serves first-page slices through Meili", async () => {
    searchCommentsMock.mockClear();
    searchCommentsMock.mockImplementationOnce(async () => ({
      items: [{ id: "comment-2" } as never, { id: "comment-1" } as never],
      total: 2,
      processingTimeMs: 1,
      query: "",
    }));
    const repository = createRepositoryStub({
      list: mock(async () => ({ comments: [], total: 0 })),
      getByIdsIncludingRedacted: mock(async (ids: string[]) =>
        ids.map((id) => commentRow({ id })),
      ),
    });
    const { createSearchBackedCommentRepository } = await import(
      "./comment.service"
    );
    const searchBacked = createSearchBackedCommentRepository(repository);

    const result = await searchBacked.list({
      rootUnitId: "root-1",
      context: { kind: "direct" },
      parentCommentId: "comment-parent",
      sort: "top",
      limit: 3,
    });

    expect(searchCommentsMock).toHaveBeenCalledWith({
      rootUnitId: "root-1",
      realmUnitId: null,
      parentCommentId: "comment-parent",
      authorUserId: undefined,
      state: undefined,
      moderationStatus: "APPROVED",
      sort: { field: "topScore", order: "desc" },
      limit: 3,
    });
    expect(repository.list).not.toHaveBeenCalled();
    expect(result.comments.map((comment) => comment.id)).toEqual([
      "comment-2",
      "comment-1",
    ]);
    expect(result.total).toBe(2);
  });

  test("search-backed repository falls back to Drizzle for cursor slices", async () => {
    searchCommentsMock.mockClear();
    const repository = createRepositoryStub({
      list: mock(async () => ({
        comments: [commentRow({ id: "comment-db" })],
        total: 1,
      })),
    });
    const { createSearchBackedCommentRepository } = await import(
      "./comment.service"
    );
    const searchBacked = createSearchBackedCommentRepository(repository);

    const result = await searchBacked.list({
      rootUnitId: "root-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      cursor: { id: "comment-cursor" },
      sort: "best",
      limit: 3,
    });

    expect(searchCommentsMock).not.toHaveBeenCalled();
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "comment-cursor" } }),
    );
    expect(result.comments.map((comment) => comment.id)).toEqual([
      "comment-db",
    ]);
  });

  test("lists direct children within one root and realm context", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.list({
      rootUnitId: "root-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      mode: "children",
      parentCommentId: "parent-1",
      limit: 20,
    });

    expect(repository.list).toHaveBeenCalledWith({
      rootUnitId: "root-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      authorUserId: undefined,
      state: undefined,
      parentCommentId: "parent-1",
      blockedAuthorIds: [],
      sort: undefined,
      cursor: undefined,
      limit: 21,
    });
  });

  test("all-mode reads interleave direct and realm comments without realm constraint", async () => {
    const repository = createRepositoryStub({
      list: mock(async () => ({
        comments: [
          commentRow({ id: "comment-direct", realmUnitId: null }),
          commentRow({ id: "comment-realm", realmUnitId: "realm-1" }),
          commentRow({ id: "comment-direct-2", realmUnitId: null }),
        ],
        total: 3,
      })),
    });
    const service = await createService(repository);

    const result = await service.list({
      rootUnitId: "root-1",
      mode: "discovery",
      limit: 20,
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ context: { kind: "all" } }),
    );
    expect(result.comments.map((comment) => comment.id)).toEqual([
      "comment-direct",
      "comment-realm",
      "comment-direct-2",
    ]);
  });

  test("direct context constrains the repository to null-realm comments", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.list({
      rootUnitId: "root-1",
      context: { kind: "direct" },
      mode: "discovery",
      limit: 20,
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ context: { kind: "direct" } }),
    );
  });

  test("search-backed all-mode reads omit the realm filter entirely", async () => {
    searchCommentsMock.mockClear();
    const repository = createRepositoryStub();
    const { createSearchBackedCommentRepository } = await import(
      "./comment.service"
    );
    const searchBacked = createSearchBackedCommentRepository(repository);

    await searchBacked.list({
      rootUnitId: "root-1",
      context: { kind: "all" },
      sort: "new",
      limit: 5,
    });

    const options = searchCommentsMock.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(options).not.toHaveProperty("realmUnitId");
    expect(options.rootUnitId).toBe("root-1");
  });

  test("search-backed realm reads filter by realm equality", async () => {
    searchCommentsMock.mockClear();
    const repository = createRepositoryStub();
    const { createSearchBackedCommentRepository } = await import(
      "./comment.service"
    );
    const searchBacked = createSearchBackedCommentRepository(repository);

    await searchBacked.list({
      rootUnitId: "root-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      sort: "new",
      limit: 5,
    });

    expect(searchCommentsMock).toHaveBeenCalledWith(
      expect.objectContaining({ realmUnitId: "realm-1" }),
    );
  });

  test("lists one extra row and returns a slice cursor", async () => {
    const repository = createRepositoryStub({
      list: mock(async () => ({
        comments: [
          commentRow({
            id: "comment-1",
            replyCount: 4,
            createdAt: new Date("2026-01-03T00:00:00.000Z"),
          }),
          commentRow({
            id: "comment-2",
            replyCount: 2,
            createdAt: new Date("2026-01-02T00:00:00.000Z"),
          }),
          commentRow({
            id: "comment-3",
            replyCount: 1,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          }),
        ],
        total: 3,
      })),
    });
    const service = await createService(repository);

    const result = await service.list({
      rootUnitId: "root-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      mode: "discovery",
      sort: "best",
      limit: 2,
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 3 }),
    );
    expect(result.comments.map((comment) => comment.id)).toEqual([
      "comment-1",
      "comment-2",
    ]);
    expect(result.nextCursor).toEqual({
      id: "comment-2",
      createdAt: "2026-01-02T00:00:00.000Z",
      sortValue: 2,
    });
    expect(result.total).toBe(3);
  });

  test("creates a direct root comment without realm validation", async () => {
    enqueueMock.mockClear();
    const repository = createRepositoryStub();
    const service = await createService(repository);

    const comment = await service.create(
      {
        rootUnitId: "post-1",
        realmUnitId: null,
        language: "en",
        content: markdownContentDoc("hello"),
      },
      "user-1",
    );

    expect(repository.create).toHaveBeenCalledWith({
      rootUnitId: "post-1",
      realmUnitId: null,
      parentCommentId: undefined,
      authorUserId: "user-1",
      language: "en",
      content: markdownContentDoc("hello"),
      depth: 1,
      parentId: undefined,
    });
    expect(repository.getRealmContextForCreate).not.toHaveBeenCalled();
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(comment.id).toBe("comment-1");
  });

  test("creates a realm-context root comment after membership validation", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.create(
      {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        language: "en",
        content: markdownContentDoc("hello"),
      },
      "user-1",
    );

    expect(repository.getRealmContextForCreate).toHaveBeenCalledWith({
      realmUnitId: "realm-1",
      rootUnitId: "post-1",
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ realmUnitId: "realm-1" }),
    );
  });

  test("rejects realm-context root comments outside the root unit's realm set", async () => {
    const repository = createRepositoryStub({
      getRealmContextForCreate: mock(async () => null),
    });
    const service = await createService(repository);

    await expect(
      service.create(
        {
          rootUnitId: "post-1",
          realmUnitId: "realm-9",
          language: "en",
          content: markdownContentDoc("hello"),
        },
        "user-1",
      ),
    ).rejects.toThrow("Realm is not an approved context");
    expect(repository.create).not.toHaveBeenCalled();
  });

  test("rejects realm-context root comments when the realm membership is locked", async () => {
    const repository = createRepositoryStub({
      getRealmContextForCreate: mock(async () => ({
        moderationStatus: "APPROVED" as const,
        isLocked: true,
      })),
    });
    const service = await createService(repository);

    await expect(
      service.create(
        {
          rootUnitId: "post-1",
          realmUnitId: "realm-1",
          language: "en",
          content: markdownContentDoc("hello"),
        },
        "user-1",
      ),
    ).rejects.toThrow("locked in this realm context");
    expect(repository.create).not.toHaveBeenCalled();
  });

  test("replies inherit the parent realm context", async () => {
    const repository = createRepositoryStub({
      getParentForCreate: mock(async (id) => ({
        id,
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        depth: 2,
        isLocked: false,
      })),
    });
    const service = await createService(repository);

    await service.create(
      {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentId: "comment-parent",
        language: "en",
        content: markdownContentDoc("reply"),
      },
      "user-1",
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentId: "comment-parent",
        depth: 3,
        parentId: "comment-parent",
      }),
    );
    expect(repository.getRealmContextForCreate).not.toHaveBeenCalled();
  });

  test("replies to direct parents stay direct", async () => {
    const repository = createRepositoryStub({
      getParentForCreate: mock(async (id) => ({
        id,
        rootUnitId: "post-1",
        realmUnitId: null,
        depth: 1,
        isLocked: false,
      })),
    });
    const service = await createService(repository);

    await service.create(
      {
        rootUnitId: "post-1",
        realmUnitId: null,
        parentCommentId: "comment-parent",
        language: "en",
        content: markdownContentDoc("reply"),
      },
      "user-1",
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ realmUnitId: null, depth: 2 }),
    );
  });

  test("rejects replies with a different explicit realm", async () => {
    const repository = createRepositoryStub({
      getParentForCreate: mock(async (id) => ({
        id,
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        depth: 1,
        isLocked: false,
      })),
    });
    const service = await createService(repository);

    await expect(
      service.create(
        {
          rootUnitId: "post-1",
          realmUnitId: "realm-2",
          parentCommentId: "comment-parent",
          language: "en",
          content: markdownContentDoc("reply"),
        },
        "user-1",
      ),
    ).rejects.toThrow("Parent comment is outside");
    expect(repository.create).not.toHaveBeenCalled();
  });

  test("discovery slices hydrate pin overlays", async () => {
    const row = commentRow({ id: "comment-1" });
    const repository = createRepositoryStub({
      list: mock(async () => ({ comments: [row], total: 1 })),
      attachPinOverlays: mock(async (comments) => {
        for (const comment of comments) {
          comment.pinKind = "PINNED";
          comment.pinPosition = "a0";
        }
        return comments;
      }),
    });
    const service = await createService(repository);

    const result = await service.list({
      rootUnitId: "root-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      mode: "discovery",
      limit: 20,
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        rootUnitId: "root-1",
        context: { kind: "realm", realmUnitId: "realm-1" },
      }),
    );
    const args = (repository.list as any).mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(args).not.toHaveProperty("parentCommentId");
    expect(result.comments[0]?.pinKind).toBe("PINNED");
    expect(result.comments[0]?.pinPosition).toBe("a0");
  });

  test("discovery reads include direct parent context without using paths", async () => {
    const child = commentRow({
      id: "comment-child",
      parentCommentId: "comment-parent",
      authorUserId: "user-2",
      content: markdownContentDoc("visible child"),
      depth: 2,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const parent = commentRow({
      id: "comment-parent",
      parentCommentId: null,
      content: markdownContentDoc("removed parent"),
      moderationStatus: "REMOVED",
    });
    const repository = createRepositoryStub({
      list: mock(async () => ({ comments: [child], total: 1 })),
      getByIdsIncludingRedacted: mock(async (ids) =>
        ids.includes("comment-parent") ? [parent] : [],
      ),
    });
    const service = await createService(repository);

    const result = await service.list({
      rootUnitId: "root-1",
      mode: "discovery",
      limit: 20,
    });

    expect(repository.getByIdsIncludingRedacted).toHaveBeenCalledWith([
      "comment-parent",
    ]);
    expect(result.total).toBe(1);
    expect(result.comments.map((comment) => comment.id)).toEqual([
      "comment-child",
    ]);
    expect(result.parentContexts?.map((comment) => comment.id)).toEqual([
      "comment-parent",
    ]);
  });

  test("root slices keep a deleted local root as context", async () => {
    const root = commentRow({
      id: "comment-root",
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      deletedAt: new Date("2026-01-03T00:00:00.000Z"),
      content: null,
    });
    const child = commentRow({
      id: "comment-child",
      parentCommentId: "comment-root",
      depth: 2,
    });
    const repository = createRepositoryStub({
      getById: mock(async () => root),
      list: mock(async () => ({ comments: [child], total: 1 })),
    });
    const service = await createService(repository);

    const result = await service.list({
      rootUnitId: "root-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      mode: "root",
      rootCommentId: "comment-root",
      limit: 20,
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        parentCommentId: "comment-root",
      }),
    );
    expect(result.rootComment?.id).toBe("comment-root");
    expect(result.comments.map((comment) => comment.id)).toEqual([
      "comment-child",
    ]);
  });

  test("root slices reject a realm root comment under direct context", async () => {
    const repository = createRepositoryStub({
      getById: mock(async () =>
        commentRow({ id: "comment-root", realmUnitId: "realm-1" }),
      ),
    });
    const service = await createService(repository);

    await expect(
      service.list({
        rootUnitId: "root-1",
        context: { kind: "direct" },
        mode: "root",
        rootCommentId: "comment-root",
        limit: 20,
      }),
    ).rejects.toThrow("Root comment is outside");
    expect(repository.list).not.toHaveBeenCalled();
  });

  test("root slices accept any partition under all-mode context", async () => {
    const repository = createRepositoryStub({
      getById: mock(async () =>
        commentRow({ id: "comment-root", realmUnitId: "realm-2" }),
      ),
    });
    const service = await createService(repository);

    const result = await service.list({
      rootUnitId: "root-1",
      mode: "root",
      rootCommentId: "comment-root",
      limit: 20,
    });

    expect(result.rootComment?.id).toBe("comment-root");
  });

  test("delete uses the soft-delete path", async () => {
    enqueueMock.mockClear();
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.delete("comment-1", "user-1");

    expect(repository.softDelete).toHaveBeenCalledWith("comment-1");
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });
});
