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

describe("userUnitCollectionApi", () => {
  test("gets and patches collection metadata for a unit", async () => {
    const { userUnitCollectionApi } = await import(
      "./user-unit-collection.api"
    );

    await userUnitCollectionApi.getForUnit("unit-1");
    await userUnitCollectionApi.patchForUnit("unit-1", {
      searchText: "private note",
      tagUnitIds: ["tag-1"],
    });

    expect(calls[0]?.url).toBe("/user-unit-collection/unit-1");
    expect(calls[1]?.url).toBe("/user-unit-collection/unit-1");
    expect(calls[1]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      unitId: "unit-1",
      searchText: "private note",
      tagUnitIds: ["tag-1"],
    });
  });

  test("searches my collection and a user's public collection", async () => {
    const { userUnitCollectionApi } = await import(
      "./user-unit-collection.api"
    );

    await userUnitCollectionApi.searchMine({
      q: "alias",
      tagUnitIds: ["tag-1", "tag-2"],
      limit: 20,
    });
    await userUnitCollectionApi.searchUser("user-1", {
      q: "title",
      cursor: "unit-1",
    });

    expect(calls[0]?.url).toBe(
      "/user-unit-collection/search/me?q=alias&tagUnitIds=tag-1&tagUnitIds=tag-2&limit=20",
    );
    expect(calls[1]?.url).toBe(
      "/user-unit-collection/search/user/user-1?q=title&cursor=unit-1",
    );
  });
});
