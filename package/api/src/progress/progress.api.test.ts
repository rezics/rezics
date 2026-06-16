import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { progressApi } from "./progress.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("progressApi read language queries", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("serializes continue-reading read language context", async () => {
    await progressApi.listMyContinueReading({
      appLocale: "en",
      languages: "zh-hant,en",
      languageMode: "preferred",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/me/progress/continue-reading?appLocale=en&languages=zh-hant%2Cen&languageMode=preferred",
    );
  });
});
