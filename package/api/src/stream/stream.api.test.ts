import { afterEach, describe, expect, mock, test } from "bun:test";
import { streamApi } from "./stream.api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("streamApi", () => {
  test("requests stream rows with scope and sort", async () => {
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

    await streamApi.rows({ scope: "home", sort: "best", limit: 10 });

    const requestUrl = fetchMock.mock.calls[0]?.[0]?.toString() ?? "";
    expect(requestUrl).toContain("/stream/rows");
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

    await streamApi.rows({
      scope: "realm",
      realmUnitId: "realm-1",
      tagIds: ["tag-1", "tag-2"],
    });

    const requestUrl = fetchMock.mock.calls[0]?.[0]?.toString() ?? "";
    expect(requestUrl).toContain("tagIds=tag-1&tagIds=tag-2");
    expect(requestUrl).not.toContain("%5B%22tag-1%22%2C%22tag-2%22%5D");
  });

  test("serializes policy tag filters separately from normal tags", async () => {
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

    await streamApi.rows({
      scope: "realm",
      realmUnitId: "realm-1",
      tagIds: ["tag-1"],
      policyTagIds: ["tag-2"],
    });

    const requestUrl = fetchMock.mock.calls[0]?.[0]?.toString() ?? "";
    expect(requestUrl).toContain("tagIds=tag-1");
    expect(requestUrl).toContain("policyTagIds=tag-2");
  });

  test("serializes zone stream scope with the zone Unit id", async () => {
    const fetchMock = mock(async (_input: Parameters<typeof fetch>[0]) => {
      return new Response(
        JSON.stringify({
          scope: "zone",
          sort: "new",
          rows: [],
          nextCursor: null,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await streamApi.rows({
      scope: "zone",
      zoneUnitId: "zone-1",
      sort: "new",
    });

    const requestUrl = fetchMock.mock.calls[0]?.[0]?.toString() ?? "";
    expect(requestUrl).toContain("scope=zone");
    expect(requestUrl).toContain("zoneUnitId=zone-1");
    expect(requestUrl).toContain("sort=new");
  });
});
