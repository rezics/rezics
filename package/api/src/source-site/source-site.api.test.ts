import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { sourceSiteApi } from "./source-site.api";
import { sourceSiteKeys } from "./source-site.keys";
import { invalidateSourceSiteQueries } from "./source-site.mutations";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("sourceSiteApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          entityUnitId: "source-site-1",
          key: "qidian",
          crawlSupport: "supported",
          crawlEnabled: true,
          crawlerAdapterKey: "qidian",
          refRules: [],
          supportsCrawl: true,
          canScheduleCrawl: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("sends create requests to the source-site endpoint", async () => {
    await sourceSiteApi.create({
      entityUnitId: "source-site-1",
      key: "qidian",
      crawlSupport: "supported",
      crawlEnabled: true,
      crawlerAdapterKey: "qidian",
      refRules: [],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.example/source-site");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        entityUnitId: "source-site-1",
        key: "qidian",
        crawlSupport: "supported",
        crawlEnabled: true,
        crawlerAdapterKey: "qidian",
        refRules: [],
      }),
    });
  });

  test("builds stable list and detail keys", () => {
    expect(sourceSiteKeys.list({ key: "qidian" })).toEqual([
      "source-site",
      "list",
      { key: "qidian" },
    ]);
    expect(sourceSiteKeys.detail("source-site-1")).toEqual([
      "source-site",
      "detail",
      "source-site-1",
    ]);
  });

  test("invalidates list, detail, and linked entity queries", () => {
    const queryClient = {
      invalidateQueries: mock(async () => undefined),
    };

    invalidateSourceSiteQueries(queryClient, "source-site-1");

    expect(
      (queryClient.invalidateQueries.mock.calls as any[]).map(
        (call) => call[0],
      ),
    ).toEqual([
      { queryKey: ["source-site", "list"] },
      { queryKey: ["source-site", "detail", "source-site-1"] },
      { queryKey: ["entity", "detail", "source-site-1"] },
    ]);
  });
});
