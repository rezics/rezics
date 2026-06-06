import { beforeEach, describe, expect, test } from "bun:test";
import { configureApi } from "../config";

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
    return new Response(JSON.stringify(null), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

describe("shelfApi shelf item routes", () => {
  test("writes shelf items with item identity in the request body", async () => {
    const { shelfApi } = await import("./shelf.api");

    await shelfApi.addItem("shelf-1", {
      itemType: "comment",
      itemId: "comment-1",
      kind: "comment",
      parentItemType: "unit",
      parentItemId: "book-1",
      parentRole: "comment",
      searchText: "private note",
    });

    expect(calls[0]?.url).toBe("/shelf/shelf-1/items");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      itemType: "comment",
      itemId: "comment-1",
      kind: "comment",
      parentItemType: "unit",
      parentItemId: "book-1",
      parentRole: "comment",
      searchText: "private note",
    });
  });

  test("addresses reorder and remove by item type plus item id", async () => {
    const { shelfApi } = await import("./shelf.api");

    await shelfApi.reorderItem("shelf-1", "comment", "comment-1", {
      afterItemId: "book-1",
    });
    await shelfApi.removeItem("shelf-1", "comment", "comment-1");

    expect(calls[0]?.url).toBe(
      "/shelf/shelf-1/items/comment/comment-1/position",
    );
    expect(calls[0]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      afterItemId: "book-1",
    });
    expect(calls[1]?.url).toBe("/shelf/shelf-1/items/comment/comment-1");
    expect(calls[1]?.init?.method).toBe("DELETE");
  });

  test("addresses child operations by parent item type plus item id", async () => {
    const { shelfApi } = await import("./shelf.api");

    await shelfApi.attachReview("shelf-1", "unit", "book-1", "review-1");
    await shelfApi.detachReview("shelf-1", "unit", "book-1", "review-1");
    await shelfApi.setChildren("shelf-1", "unit", "book-1", {
      role: "comment",
      childItemType: "comment",
      childItemIds: ["comment-1"],
    });

    expect(calls[0]?.url).toBe("/shelf/shelf-1/items/unit/book-1/reviews");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      reviewUnitId: "review-1",
    });
    expect(calls[1]?.url).toBe(
      "/shelf/shelf-1/items/unit/book-1/reviews/review-1",
    );
    expect(calls[1]?.init?.method).toBe("DELETE");
    expect(calls[2]?.url).toBe("/shelf/shelf-1/items/unit/book-1/children");
    expect(calls[2]?.init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
      role: "comment",
      childItemType: "comment",
      childItemIds: ["comment-1"],
    });
  });
});
