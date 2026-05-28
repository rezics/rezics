import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { workRealmContextApi } from "./work-realm-context.api";
import { workRealmContextKeys } from "./work-realm-context.keys";
import { invalidateWorkRealmContextQueries } from "./work-realm-context.mutations";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("workRealmContextApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "context-1",
          workUnitId: "work-1",
          realmUnitId: "realm-1",
          role: "official",
          priority: 0,
          locale: null,
          releaseUnitId: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("sends create requests to the work realm context endpoint", async () => {
    await workRealmContextApi.create({
      workUnitId: "work-1",
      realmUnitId: "realm-1",
      role: "official",
      priority: 0,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/work-realm-context",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        workUnitId: "work-1",
        realmUnitId: "realm-1",
        role: "official",
        priority: 0,
      }),
    });
  });

  test("sends resolve requests with release context filters", async () => {
    await workRealmContextApi.resolve({
      releaseUnitId: "release-1",
      locale: "en",
      includeCommunity: true,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/work-realm-context/resolve?releaseUnitId=release-1&locale=en&includeCommunity=true",
    );
  });

  test("builds stable list, detail, and release resolve keys", () => {
    expect(workRealmContextKeys.list({ workUnitId: "work-1" })).toEqual([
      "work-realm-context",
      "list",
      { workUnitId: "work-1" },
    ]);
    expect(workRealmContextKeys.detail("context-1")).toEqual([
      "work-realm-context",
      "detail",
      "context-1",
    ]);
    expect(
      workRealmContextKeys.byRelease("release-1", {
        locale: "en",
        includeCommunity: true,
      }),
    ).toEqual([
      "work-realm-context",
      "resolve",
      "release",
      "release-1",
      { locale: "en", includeCommunity: true },
    ]);
  });

  test("invalidates list, resolve, and detail queries", () => {
    const queryClient = {
      invalidateQueries: mock(async () => undefined),
    };

    invalidateWorkRealmContextQueries(queryClient, {
      id: "context-1",
      workUnitId: "work-1",
      realmUnitId: "realm-1",
      releaseUnitId: null,
    });

    expect(
      (queryClient.invalidateQueries.mock.calls as any[]).map(
        (call) => call[0],
      ),
    ).toEqual([
      { queryKey: ["work-realm-context", "list"] },
      { queryKey: ["work-realm-context", "resolve"] },
      { queryKey: ["work-realm-context", "detail", "context-1"] },
    ]);
  });
});
