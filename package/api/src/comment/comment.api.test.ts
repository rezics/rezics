import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { invalidateCommentModerationQueries } from "./comment.mutations";

const calls: Array<{ url: string; init?: RequestInit }> = [];

beforeEach(() => {
  configureApi({
    apiBaseUrl: "",
    authBaseUrl: "",
    reactionServiceUrl: "",
  });
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ comments: [], total: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

describe("commentApi", () => {
  test("lists, creates, updates, moderates, and deletes comments", async () => {
    const { commentApi } = await import("./comment.api");

    await commentApi.list({
      rootUnitId: "post-1",
      context: { kind: "realm", realmUnitId: "realm-1" },
      mode: "discovery",
      limit: 20,
    });
    await commentApi.create({
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
      content: { runtime: "doc-v1", source: { markdown: "hello" } },
    });
    await commentApi.update("comment-1", {
      content: { runtime: "doc-v1", source: { markdown: "updated" } },
    });
    await commentApi.moderate("comment-1", {
      action: "remove",
      reasonCode: "comment.abuse",
      requestId: "request-1",
    });
    await commentApi.delete("comment-1");

    expect(calls[0]?.url).toContain("/comment/list?");
    // GET context rides the query string as a JSON-encoded object.
    // GET 的 context 以 JSON 编码对象的形式放在查询字符串中。
    expect(calls[0]?.url).toContain(
      `context=${encodeURIComponent(
        JSON.stringify({ kind: "realm", realmUnitId: "realm-1" }),
      )}`,
    );
    expect(calls[1]?.url).toBe("/comment/");
    expect(calls[1]?.init?.method).toBe("POST");
    expect(calls[2]?.url).toBe("/comment/comment-1");
    expect(calls[2]?.init?.method).toBe("PATCH");
    expect(calls[3]?.url).toBe("/comment/comment-1/moderation");
    expect(calls[3]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      action: "remove",
      reasonCode: "comment.abuse",
      requestId: "request-1",
    });
    expect(calls[4]?.url).toBe("/comment/comment-1");
    expect(calls[4]?.init?.method).toBe("DELETE");
  });

  test("comment moderation invalidates comments, root post, and overlays", () => {
    const queryClient = {
      invalidateQueries: mock(async () => undefined),
    };

    invalidateCommentModerationQueries(queryClient, {
      id: "comment-1",
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
    });

    expect(
      (queryClient.invalidateQueries.mock.calls as any[]).map(
        (call) => call[0].queryKey,
      ),
    ).toEqual([
      ["comments"],
      ["comments", "detail", "comment-1"],
      ["posts", "detail", "post-1"],
      ["posts", "moderation-overlays", "realm-1", ["comment-1"]],
      [
        "governance",
        "moderation-overlays",
        "comment",
        "realm-1",
        ["comment-1"],
      ],
    ]);
  });
});
