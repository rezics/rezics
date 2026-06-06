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
});
