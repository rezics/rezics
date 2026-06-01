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
    return new Response(JSON.stringify({ translations: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

describe("contentTranslationApi", () => {
  test("lists, gets, upserts, and deletes content translations", async () => {
    const { contentTranslationApi } = await import("./content-translation.api");

    await contentTranslationApi.list("wiki-1");
    await contentTranslationApi.get("wiki-1", "en");
    await contentTranslationApi.upsert("wiki-1", "en", {
      content: { main: { type: "markdown", source: "Body" } },
      status: "PUBLISHED",
    });
    await contentTranslationApi.delete("wiki-1", "en");

    expect(calls[0]?.url).toBe("/content-translation/wiki-1");
    expect(calls[1]?.url).toBe("/content-translation/wiki-1/en");
    expect(calls[2]?.url).toBe("/content-translation/wiki-1/en");
    expect(calls[2]?.init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
      unitId: "wiki-1",
      language: "en",
      content: { main: { type: "markdown", source: "Body" } },
      status: "PUBLISHED",
    });
    expect(calls[3]?.url).toBe("/content-translation/wiki-1/en");
    expect(calls[3]?.init?.method).toBe("DELETE");
  });
});
