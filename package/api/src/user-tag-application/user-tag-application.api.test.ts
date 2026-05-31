import { beforeEach, describe, expect, test } from "bun:test";

const calls: Array<{ url: string; init?: RequestInit }> = [];

beforeEach(() => {
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

describe("userTagApplicationApi", () => {
  test("lists and replaces the caller's tags for a unit", async () => {
    const { userTagApplicationApi } = await import(
      "./user-tag-application.api"
    );

    await userTagApplicationApi.listForUnit("unit-1");
    await userTagApplicationApi.setForUnit("unit-1", {
      tagUnitIds: ["tag-1"],
    });

    expect(calls[0]?.url).toBe("/user-tag-application/unit-1");
    expect(calls[1]?.url).toBe("/user-tag-application/unit-1");
    expect(calls[1]?.init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      unitId: "unit-1",
      tagUnitIds: ["tag-1"],
    });
  });

  test("reorders and deletes one user tag application", async () => {
    const { userTagApplicationApi } = await import(
      "./user-tag-application.api"
    );

    await userTagApplicationApi.reorder("unit-1", "tag-1", {
      beforeTagUnitId: "tag-0",
    });
    await userTagApplicationApi.deleteOne("unit-1", "tag-1");

    expect(calls[0]?.url).toBe("/user-tag-application/unit-1/tag-1/position");
    expect(calls[0]?.init?.method).toBe("PATCH");
    expect(calls[1]?.url).toBe("/user-tag-application/unit-1/tag-1");
    expect(calls[1]?.init?.method).toBe("DELETE");
  });
});
