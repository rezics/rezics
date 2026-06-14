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

describe("userShelfItemApi", () => {
  test("gets and patches shelf item metadata for a unit", async () => {
    const { userShelfItemApi } = await import("./user-shelf-item.api");

    await userShelfItemApi.getForUnit("unit-1");
    await userShelfItemApi.patchForUnit("unit-1", {
      searchText: "private note",
      tagUnitIds: ["tag-1"],
    });

    expect(calls[0]?.url).toBe("/shelf/item/metadata/unit-1");
    expect(calls[1]?.url).toBe("/shelf/item/metadata/unit-1");
    expect(calls[1]?.init?.method).toBe("PATCH");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      unitId: "unit-1",
      searchText: "private note",
      tagUnitIds: ["tag-1"],
    });
  });

  test("searches my shelf items and a user's public shelf items", async () => {
    const { userShelfItemApi } = await import("./user-shelf-item.api");

    await userShelfItemApi.searchMine({
      q: "alias",
      tagUnitIds: ["tag-1", "tag-2"],
      limit: 20,
    });
    await userShelfItemApi.searchUser("user-1", {
      q: "title",
      cursor: "unit-1",
    });

    expect(calls[0]?.url).toBe(
      "/shelf/item/search/me?q=alias&tagUnitIds=tag-1&tagUnitIds=tag-2&limit=20",
    );
    expect(calls[1]?.url).toBe(
      "/shelf/item/search/user/user-1?q=title&cursor=unit-1",
    );
  });
});
