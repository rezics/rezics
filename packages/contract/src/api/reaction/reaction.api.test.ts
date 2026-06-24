import { beforeEach, describe, expect, test } from "bun:test";
import { configureApi } from "../config";

const calls: Array<{ url: string; init?: RequestInit }> = [];

beforeEach(() => {
  configureApi({
    apiBaseUrl: "",
    authBaseUrl: "",
    reactionServiceUrl: "http://reaction.example",
  });
  calls.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(
      JSON.stringify({
        summaries: { "unit-1": { shareCount: 1 } },
        targetId: "unit-1",
        shareCount: 1,
        created: true,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;
});

describe("reactionApi share", () => {
  test("reads share summaries from reaction service and writes through main API", async () => {
    const { reactionApi } = await import("./reaction.api");

    await reactionApi.shareSummary(["unit-1", "unit-2"]);
    await reactionApi.share({ targetId: "unit-1" });

    expect(calls[0]?.url).toBe(
      "http://reaction.example/reaction/share/summary?targetIds=unit-1&targetIds=unit-2",
    );
    expect(calls[1]?.url).toBe("/reaction/share");
    expect(calls[1]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      targetId: "unit-1",
    });
  });
});
