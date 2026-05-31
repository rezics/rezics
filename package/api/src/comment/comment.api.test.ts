import { beforeEach, describe, expect, test } from "bun:test";

const calls: Array<{ url: string; init?: RequestInit }> = [];

beforeEach(() => {
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
  test("lists, creates, updates, and deletes comments", async () => {
    const { commentApi } = await import("./comment.api");

    await commentApi.list({
      rootUnitId: "post-1",
      realmUnitId: "realm-1",
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
    await commentApi.delete("comment-1");

    expect(calls[0]?.url).toContain("/comment/list?");
    expect(calls[1]?.url).toBe("/comment/");
    expect(calls[1]?.init?.method).toBe("POST");
    expect(calls[2]?.url).toBe("/comment/comment-1");
    expect(calls[2]?.init?.method).toBe("PATCH");
    expect(calls[3]?.url).toBe("/comment/comment-1");
    expect(calls[3]?.init?.method).toBe("DELETE");
  });
});
