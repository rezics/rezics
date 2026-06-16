import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { Elysia } from "elysia";
import { commentService } from "./comment.service";
import type { CommentWithRelations } from "./comment.types";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};

const moderateCommentMock = mock(async () => ({ id: "comment-1" }));

function commentRow(
  overrides: Partial<CommentWithRelations> = {},
): CommentWithRelations {
  return {
    id: "comment-1",
    rootUnitId: "post-1",
    realmUnitId: null,
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
  } as CommentWithRelations;
}

const getByIdSpy = spyOn(commentService, "getById").mockResolvedValue(
  commentRow(),
);
const listSpy = spyOn(commentService, "list").mockResolvedValue({
  comments: [],
  total: 0,
});

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

describe("commentApi", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    currentIdentity = {
      sub: "user-1",
      userId: "user-1",
      permission: { role: "USER" },
    };
    moderateCommentMock.mockClear();
    getByIdSpy.mockClear();
    getByIdSpy.mockResolvedValue(commentRow());
    listSpy.mockClear();
    listSpy.mockResolvedValue({ comments: [], total: 0 });
  });

  test("moderates a comment with the authenticated identity", async () => {
    getByIdSpy.mockResolvedValue(commentRow({ moderationStatus: "REMOVED" }));
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
    expect(getByIdSpy).toHaveBeenCalledWith("comment-1");
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

  test("GET /comment/list defaults to all-mode when context is omitted", async () => {
    const { commentApi } = await import("./comment.api");
    const response = await commentApi.handle(
      new Request(
        "http://localhost/comment/list?rootUnitId=post-1&mode=discovery&limit=10",
      ),
    );

    expect(response.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ rootUnitId: "post-1", context: undefined }),
      { viewerUserId: undefined },
    );
  });

  test("GET /comment/list parses a JSON-encoded context query param", async () => {
    const { commentApi } = await import("./comment.api");
    const context = encodeURIComponent(
      JSON.stringify({ kind: "realm", realmUnitId: "realm-1" }),
    );
    const response = await commentApi.handle(
      new Request(
        `http://localhost/comment/list?rootUnitId=post-1&mode=discovery&limit=10&context=${context}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { kind: "realm", realmUnitId: "realm-1" },
      }),
      { viewerUserId: undefined },
    );
  });

  test("GET /comment/list rejects malformed context payloads", async () => {
    const { commentApi } = await import("./comment.api");
    const context = encodeURIComponent(JSON.stringify({ kind: "elsewhere" }));
    const response = await commentApi.handle(
      new Request(
        `http://localhost/comment/list?rootUnitId=post-1&mode=discovery&limit=10&context=${context}`,
      ),
    );

    expect(response.status).not.toBe(200);
    expect(listSpy).not.toHaveBeenCalled();
  });

  test("POST /comment/list accepts the typed context union in the body", async () => {
    const { commentApi } = await import("./comment.api");
    const response = await commentApi.handle(
      new Request("http://localhost/comment/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rootUnitId: "post-1",
          mode: "discovery",
          context: { kind: "direct" },
          limit: 10,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ context: { kind: "direct" } }),
      { viewerUserId: undefined },
    );
  });
});
