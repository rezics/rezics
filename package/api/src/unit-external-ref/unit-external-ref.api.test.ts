import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { unitExternalRefApi } from "./unit-external-ref.api";
import { unitExternalRefKeys } from "./unit-external-ref.keys";
import { invalidateUnitExternalRefQueries } from "./unit-external-ref.mutations";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("unitExternalRefApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "ref-1",
          unitId: "book-1",
          sourceSiteEntityUnitId: "source-site-1",
          externalKind: "book",
          externalId: "123",
          canonicalUrl: "https://book.qidian.com/info/123",
          firstSeenAt: "2026-05-25T00:00:00.000Z",
          lastSeenAt: "2026-05-25T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("sends create requests to the unit-external-ref endpoint", async () => {
    await unitExternalRefApi.create({
      unitId: "book-1",
      sourceSiteEntityUnitId: "source-site-1",
      externalKind: "book",
      externalId: "123",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/unit-external-ref",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        unitId: "book-1",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "book",
        externalId: "123",
      }),
    });
  });

  test("sends URL parse requests", async () => {
    await unitExternalRefApi.parseUrl({
      sourceSiteEntityUnitId: "source-site-1",
      url: "https://book.qidian.com/info/123",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/unit-external-ref/parse-url",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        sourceSiteEntityUnitId: "source-site-1",
        url: "https://book.qidian.com/info/123",
      }),
    });
  });

  test("invalidates list and credit queries", () => {
    const queryClient = {
      invalidateQueries: mock(async () => undefined),
    };

    invalidateUnitExternalRefQueries(queryClient, "book-1");

    expect(
      (queryClient.invalidateQueries.mock.calls as any[]).map(
        (call) => call[0],
      ),
    ).toEqual([
      { queryKey: ["unit-external-ref", "list"] },
      { queryKey: ["credit-attribution", "by-unit", "book-1"] },
    ]);
  });

  test("exposes stable parse URL keys", () => {
    expect(
      unitExternalRefKeys.parseUrl(
        "source-site-1",
        "https://book.qidian.com/info/123",
      ),
    ).toEqual([
      "unit-external-ref",
      "parse-url",
      "source-site-1",
      "https://book.qidian.com/info/123",
    ]);
  });
});
