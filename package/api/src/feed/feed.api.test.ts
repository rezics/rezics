import { afterEach, describe, expect, mock, test } from "bun:test";
import { feedApi } from "./feed.api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("feedApi", () => {
  test("requests feed rows with scope and sort", async () => {
    const fetchMock = mock(async (_input: Parameters<typeof fetch>[0]) => {
      return new Response(
        JSON.stringify({
          scope: "home",
          sort: "best",
          rows: [],
          nextCursor: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await feedApi.rows({ scope: "home", sort: "best", limit: 10 });

    const requestUrl = fetchMock.mock.calls[0]?.[0]?.toString() ?? "";
    expect(requestUrl).toContain("/feed/rows");
    expect(requestUrl).toContain("scope=home");
    expect(requestUrl).toContain("sort=best");
  });

  test("serializes tag filters as repeated query params", async () => {
    const fetchMock = mock(async (_input: Parameters<typeof fetch>[0]) => {
      return new Response(
        JSON.stringify({
          scope: "realm",
          sort: "best",
          rows: [],
          nextCursor: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await feedApi.rows({
      scope: "realm",
      realmUnitId: "realm-1",
      tagIds: ["tag-1", "tag-2"],
    });

    const requestUrl = fetchMock.mock.calls[0]?.[0]?.toString() ?? "";
    expect(requestUrl).toContain("tagIds=tag-1&tagIds=tag-2");
    expect(requestUrl).not.toContain("%5B%22tag-1%22%2C%22tag-2%22%5D");
  });
});
