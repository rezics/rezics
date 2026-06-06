import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};

const moderateCommentMock = mock(async () => ({ id: "comment-1" }));
const getByIdMock = mock(async () => ({ id: "comment-1" }));
const mapCommentToDTOMock = mock((comment: any) => ({
  id: comment.id,
  unitId: comment.id,
  rootUnitId: "post-1",
  moderationStatus: "removed",
  content: null,
  isRedacted: true,
  depth: 1,
}));

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({ identity: currentIdentity }),
  }),
  tryResolveIdentity: mock(async () => null),
}));

mock.module("@/governance", () => ({
  governanceModerationService: {
    moderateComment: moderateCommentMock,
  },
}));

mock.module("@/post/post.service", () => ({
  postService: {
    getThreadPromotionSignals: mock(async () => ({})),
  },
}));

mock.module("./comment.mapper", () => ({
  mapCommentToDTO: mapCommentToDTOMock,
}));

mock.module("./comment.service", () => ({
  commentService: {
    getById: getByIdMock,
    list: mock(async () => ({ comments: [], total: 0 })),
    create: mock(async () => ({ id: "comment-1" })),
    update: mock(async () => ({ id: "comment-1" })),
    delete: mock(async () => undefined),
  },
}));

describe("commentApi", () => {
  beforeEach(() => {
    currentIdentity = {
      sub: "user-1",
      userId: "user-1",
      permission: { role: "USER" },
    };
    moderateCommentMock.mockClear();
    getByIdMock.mockClear();
    mapCommentToDTOMock.mockClear();
  });

  test("moderates a comment with the authenticated identity", async () => {
    const { commentApi } = await import("./comment.api");
    const response = await commentApi.handle(
      new Request("http://localhost/comment/comment-1/moderation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          reasonCode: "comment.abuse",
          reasonText: "abuse",
          requestId: "request-1",
          idempotencyKey: "request-1:comment-1:remove",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(moderateCommentMock).toHaveBeenCalledWith({
      commentId: "comment-1",
      actorUserId: "user-1",
      identity: currentIdentity,
      action: "remove",
      reasonCode: "comment.abuse",
      reasonText: "abuse",
      requestId: "request-1",
      idempotencyKey: "request-1:comment-1:remove",
    });
    expect(getByIdMock).toHaveBeenCalledWith("comment-1");
    expect(await response.json()).toMatchObject({
      id: "comment-1",
      moderationStatus: "removed",
      isRedacted: true,
    });
  });

  test("rejects unsupported moderation actions before calling governance", async () => {
    const { commentApi } = await import("./comment.api");
    const response = await commentApi.handle(
      new Request("http://localhost/comment/comment-1/moderation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "hide",
          reasonCode: "comment.abuse",
        }),
      }),
    );

    expect(response.status).toBe(422);
    expect(moderateCommentMock).not.toHaveBeenCalled();
  });
});
