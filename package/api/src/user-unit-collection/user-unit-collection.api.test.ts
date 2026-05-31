import { beforeEach, describe, expect, test } from "bun:test";

const calls: Array<{ url: string; init?: RequestInit }> = [];

beforeEach(() => {
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
});
