import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { dashboardApi } from "./dashboard.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("dashboardApi read language queries", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("serializes dashboard read language context", async () => {
    await dashboardApi.getSummary({
      appLocale: "en",
      languages: "zh-hant,en",
      languageMode: "preferred",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/me/dashboard?appLocale=en&languages=zh-hant%2Cen&languageMode=preferred",
    );
  });
});
