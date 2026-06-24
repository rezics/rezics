import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";

const calls: Array<{ url: string; init?: RequestInit }> = [];

describe("unitApi language reads", () => {
  beforeEach(() => {
    configureApi({
      apiBaseUrl: "",
      authBaseUrl: "",
      reactionServiceUrl: "",
    });
    calls.length = 0;
    globalThis.fetch = mock(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    ) as unknown as typeof fetch;
  });

  test("requests lightweight language availability and content", async () => {
    const { unitApi } = await import("./unit.api");

    await unitApi.languages("unit-1");
    await unitApi.languageContent("unit-1", {
      explicitLanguage: "ja",
      appLocale: "en",
    });

    expect(calls.map((call) => call.url)).toEqual([
      "/unit/unit-1/languages",
      "/unit/unit-1/languages/content?explicitLanguage=ja&appLocale=en",
    ]);
  });

  test("serializes list read languages as comma-separated candidates", async () => {
    const { unitApi } = await import("./unit.api");

    await unitApi.list({
      languages: ["zh-Hant", "ja", "en"],
      appLocale: "zh-hant",
    });

    expect(calls[0]?.url).toBe(
      "/unit/list?languages=zh-Hant%2Cja%2Cen&appLocale=zh-hant",
    );
  });
});
