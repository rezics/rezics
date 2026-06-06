import { afterEach, describe, expect, mock, test } from "bun:test";
import { feedApi } from "./feed.api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("feedApi", () => {
  test("requests feed rows with scope and sort", async () => {
    const fetchMock = mock(async () => {
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

    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toContain("/feed/rows");
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toContain("scope=home");
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toContain("sort=best");
  });
});
