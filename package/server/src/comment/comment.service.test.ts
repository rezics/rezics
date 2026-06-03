import { describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { installPrismaClientMock, prismaMock } from "../test/prisma-client-mock";

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

installPrismaClientMock();

describe("CommentService", () => {
  test("lists direct children within one root and realm partition", async () => {
    const findMany = mock(async () => []);
    const count = mock(async () => 0);
    const queryRaw = mock(async () => []);
    Object.assign(prismaMock, {
      comment: { findMany, count },
      commentPromotion: { findMany: mock(async () => []) },
      $queryRaw: queryRaw,
    });

    const { CommentService } = await import("./comment.service");
    await new CommentService().list({
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      limit: 20,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        rootUnitId: "root-1",
        realmUnitId: "realm-1",
        visibilityState: { in: ["VISIBLE", "TOMBSTONED"] },
        parentCommentId: null,
      },
      orderBy: [{ createdAt: "asc" }],
      skip: 0,
      take: 20,
      include: {
        author: {
          select: {
            unitId: true,
            name: true,
            avatar: true,
            bio: true,
            description: true,
            followersCount: true,
            followingsCount: true,
          },
        },
      },
    });
    expect(count).toHaveBeenCalled();
  });

  test("creates a direct root comment and enqueues search sync", async () => {
    enqueueMock.mockClear();
    const commentCreate = mock(async () => ({
      id: "comment-1",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentId: null,
      authorUserId: "user-1",
      content: markdownContentDoc("hello"),
      depth: 1,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      isLocked: false,
      state: null,
      visibilityState: "VISIBLE",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      author: null,
    }));
    const executeRaw = mock(async () => 1);
    const updateMany = mock(async () => ({ count: 1 }));
    const queryRaw = mock(async () => [{ id: "comment-1", path: "1" }]);
    const transaction = mock(async (fn: any) =>
      fn({
        comment: { create: commentCreate },
        post: { updateMany },
        $executeRaw: executeRaw,
      }),
    );
    Object.assign(prismaMock, {
      $transaction: transaction,
      $queryRaw: queryRaw,
      comment: { findUniqueOrThrow: mock(async () => null) },
      commentPromotion: { findMany: mock(async () => []) },
    });

    const { CommentService } = await import("./comment.service");
    const comment = await new CommentService().create(
      {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        content: markdownContentDoc("hello"),
      },
      "user-1",
    );

    expect(commentCreate).toHaveBeenCalledWith({
      data: {
        rootUnitId: "post-1",
        realmUnitId: "realm-1",
        parentCommentId: undefined,
        authorUserId: "user-1",
        content: markdownContentDoc("hello"),
        depth: 1,
        visibilityState: "VISIBLE",
      },
      include: { author: { select: expect.any(Object) } },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { unitId: "post-1" },
      data: {
        replyCount: { increment: 1 },
        directReplyCount: { increment: 1 },
        lastReplyAt: expect.any(Date),
      },
    });
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(comment.path).toBe("1");
  });

  test("lists a whole threaded partition and hydrates pin overlays", async () => {
    const commentRow = {
      id: "comment-1",
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      parentCommentId: null,
      authorUserId: "user-1",
      content: null,
      depth: 1,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      isLocked: false,
      state: null,
      visibilityState: "VISIBLE",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      author: null,
    };
    const findMany = mock(async (_args: any) => [commentRow]);
    const count = mock(async () => 1);
    const pinFindMany = mock(async () => [
      {
        scopeUnitId: "root-1",
        commentId: "comment-1",
        kind: "PINNED",
        position: "a0",
      },
    ]);
    const queryRaw = mock(async () => [{ id: "comment-1", path: "1" }]);
    Object.assign(prismaMock, {
      comment: { findMany, count },
      commentPromotion: { findMany: pinFindMany },
      $queryRaw: queryRaw,
    });

    const { CommentService } = await import("./comment.service");
    const result = await new CommentService().list({
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      mode: "threaded",
      maxDepth: 4,
      limit: 20,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          rootUnitId: "root-1",
          realmUnitId: "realm-1",
          depth: { lte: 4 },
        }),
      }),
    );
    const findManyArgs = findMany.mock.calls[0]?.[0] as any;
    expect(findManyArgs.where).not.toHaveProperty("parentCommentId");
    expect(pinFindMany).toHaveBeenCalledWith({
      where: {
        scopeUnitId: { in: ["root-1"] },
        commentId: { in: ["comment-1"] },
      },
      select: {
        scopeUnitId: true,
        commentId: true,
        kind: true,
        position: true,
      },
    });
    expect(result.comments[0]?.pinKind).toBe("PINNED");
    expect(result.comments[0]?.pinPosition).toBe("a0");
  });
});
