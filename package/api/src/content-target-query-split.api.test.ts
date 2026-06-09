import { beforeEach, describe, expect, mock, test } from "bun:test";
import { PostKind } from "@rezics/contract";
import { chapterApi } from "./chapter/chapter.api";
import { commentApi } from "./comment/comment.api";
import { configureApi } from "./config";
import { postApi } from "./post/post.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("target query split", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ posts: [], comments: [], chapters: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("post-like page feeds query Unit.targetUnitId", async () => {
    await postApi.getByTarget("book-1", { limit: 10 });
    await postApi.getByTarget("game-1", {
      kind: PostKind.REVIEW,
      limit: 5,
    });
    await postApi.getByTarget("media-1", {
      kind: PostKind.EXCERPT,
      limit: 5,
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://api.example/post/list?targetUnitId=book-1&limit=10",
      "http://api.example/post/list?targetUnitId=game-1&kind=REVIEW&limit=5",
      "http://api.example/post/list?targetUnitId=media-1&kind=EXCERPT&limit=5",
    ]);
  });

  test("variant context post feeds query variantUnitId separately", async () => {
    await postApi.getByVariant("variant-1", { limit: 10 });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://api.example/post/list?variantUnitId=variant-1&limit=10",
    ]);
  });

  test("chapter pages query Unit.targetUnitId while comments query topology", async () => {
    await chapterApi.getByTargetUnitId("book-1", { limit: 20 });
    const realmContext = encodeURIComponent(
      JSON.stringify({ kind: "realm", realmUnitId: "realm-1" }),
    );
    await commentApi.list({
      rootUnitId: "post-root-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      mode: "discovery",
      limit: 50,
    });
    await commentApi.list({
      rootUnitId: "chapter-discussion-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      mode: "root",
      rootCommentId: "comment-1",
      limit: 50,
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://api.example/chapter/list?targetUnitId=book-1&limit=20",
      `http://api.example/comment/list?rootUnitId=post-root-1&context=${realmContext}&mode=discovery&limit=50`,
      `http://api.example/comment/list?rootUnitId=chapter-discussion-1&context=${realmContext}&mode=root&rootCommentId=comment-1&limit=50`,
    ]);
  });
});
