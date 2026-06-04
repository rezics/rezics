import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import type { CommentRepository, CommentService } from "./comment.service";
import type { CommentWithRelations } from "./comment.types";

const enqueueMock = mock(async () => ({ status: "created" }));

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
    depth: 1,
    path: null,
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
    getById: mock(async (id) => commentRow({ id })),
    getSubtreeAnchor: mock(async () => null),
    listSubtreeDescendantIds: mock(async () => []),
    findRedactedAncestors: mock(async () => []),
    attachPaths: mock(async (comments) => {
      for (const comment of comments) comment.path ??= "1";
      return comments;
    }),
    attachPinOverlays: mock(async (comments) => comments),
    getParentForCreate: mock(async (id) => ({
      id,
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      depth: 1,
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
      realmUnitId: "realm-1",
    })),
    update: mock(async (id, input) =>
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
  test("lists direct children within one root and realm partition", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.list({
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      limit: 20,
    });

    expect(repository.list).toHaveBeenCalledWith({
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      authorUserId: undefined,
      state: undefined,
      ids: undefined,
      maxDepth: undefined,
      parentCommentId: null,
      blockedAuthorIds: [],
      sort: undefined,
      limit: 20,
    });
  });

  test("creates a direct root comment and enqueues search sync", async () => {
    enqueueMock.mockClear();
    const repository = createRepositoryStub();
    const service = await createService(repository);

    const comment = await service.create(
      {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        content: markdownContentDoc("hello"),
      },
      "user-1",
    );

    expect(repository.create).toHaveBeenCalledWith({
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentId: undefined,
      authorUserId: "user-1",
      content: markdownContentDoc("hello"),
      depth: 1,
      parentId: undefined,
    });
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(comment.path).toBe("1");
  });

  test("lists a whole threaded partition and hydrates pin overlays", async () => {
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
      realmUnitId: "realm-1",
      mode: "threaded",
      maxDepth: 4,
      limit: 20,
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        rootUnitId: "root-1",
        realmUnitId: "realm-1",
        maxDepth: 4,
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

  test("threaded reads include only redacted ancestors needed to preserve the tree", async () => {
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
      findRedactedAncestors: mock(async (ids) =>
        ids.includes("comment-parent") ? [parent] : [],
      ),
      attachPaths: mock(async (comments) => {
        for (const comment of comments) {
          comment.path = comment.id === "comment-parent" ? "1" : "1.1";
        }
        return comments;
      }),
    });
    const service = await createService(repository);

    const result = await service.list({
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      mode: "threaded",
      limit: 20,
    });

    expect(repository.findRedactedAncestors).toHaveBeenCalledWith([
      "comment-parent",
    ]);
    expect(result.total).toBe(1);
    expect(result.comments.map((comment) => comment.id)).toEqual([
      "comment-parent",
      "comment-child",
    ]);
  });
});
