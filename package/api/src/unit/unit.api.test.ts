import { beforeEach, describe, expect, mock, test } from "bun:test";

const calls: Array<{ url: string; init?: RequestInit }> = [];

mock.module("../react-query/http", () => ({
  apiFetch: mock(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {};
  }),
}));

describe("unitApi language reads", () => {
  beforeEach(() => {
    calls.length = 0;
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
      languageMode: "preferred",
    });

    expect(calls[0]?.url).toBe(
      "/unit/list?languages=zh-Hant%2Cja%2Cen&appLocale=zh-hant&languageMode=preferred",
    );
  });
});
