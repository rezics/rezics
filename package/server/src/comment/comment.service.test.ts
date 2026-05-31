import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

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
        unit: {
          OR: [
            { status: "PUBLISHED", visibility: "PUBLIC" },
            { status: "DELETED", visibility: "PUBLIC" },
          ],
        },
        parentCommentUnitId: null,
      },
      orderBy: [{ createdAt: "asc" }],
      skip: 0,
      take: 20,
      include: {
        unit: {
          include: {
            user: {
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
            contentModerationState: true,
          },
        },
      },
    });
    expect(count).toHaveBeenCalled();
  });

  test("creates a direct root comment and enqueues search sync", async () => {
    enqueueMock.mockClear();
    const unitCreate = mock(async () => ({ id: "comment-1" }));
    const commentCreate = mock(async () => ({
      unitId: "comment-1",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      parentCommentUnitId: null,
      authorUserId: "user-1",
      content: { runtime: "doc-v1", source: { markdown: "hello" } },
      depth: 1,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      isLocked: false,
      state: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      unit: {
        status: "PUBLISHED",
        user: null,
        contentModerationState: null,
      },
    }));
    const executeRaw = mock(async () => 1);
    const updateMany = mock(async () => ({ count: 1 }));
    const queryRaw = mock(async () => [{ unitId: "comment-1", path: "1" }]);
    const transaction = mock(async (fn: any) =>
      fn({
        unit: { create: unitCreate },
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
        content: { runtime: "doc-v1", source: { markdown: "hello" } },
      },
      "user-1",
    );

    expect(unitCreate).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        slugScope: "user-1",
        type: "COMMENT",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        publishedAt: expect.any(Date),
      },
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
      unitId: "comment-1",
      rootUnitId: "root-1",
      realmUnitId: "realm-1",
      parentCommentUnitId: null,
      authorUserId: "user-1",
      content: null,
      depth: 1,
      replyCount: 0,
      directReplyCount: 0,
      lastReplyAt: null,
      isLocked: false,
      state: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      unit: {
        status: "PUBLISHED",
        user: null,
        contentModerationState: null,
      },
    };
    const findMany = mock(async () => [commentRow]);
    const count = mock(async () => 1);
    const pinFindMany = mock(async () => [
      {
        scopeUnitId: "root-1",
        commentUnitId: "comment-1",
        kind: "PINNED",
        position: "a0",
      },
    ]);
    const queryRaw = mock(async () => [{ unitId: "comment-1", path: "1" }]);
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
    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty(
      "parentCommentUnitId",
    );
    expect(pinFindMany).toHaveBeenCalledWith({
      where: {
        scopeUnitId: { in: ["root-1"] },
        commentUnitId: { in: ["comment-1"] },
      },
      select: {
        scopeUnitId: true,
        commentUnitId: true,
        kind: true,
        position: true,
      },
    });
    expect(result.comments[0]?.pinKind).toBe("PINNED");
    expect(result.comments[0]?.pinPosition).toBe("a0");
  });
});
