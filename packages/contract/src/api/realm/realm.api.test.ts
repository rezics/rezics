import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { realmApi } from "./realm.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("realmApi read language queries", () => {
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

  test("serializes member realms read language context", async () => {
    await realmApi.byMember("user-1", {
      view: "managing",
      appLocale: "zh-hant",
      languages: ["en", "ja"],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/realm/member/user-1?view=managing&appLocale=zh-hant&languages=en%2Cja",
    );
  });

  test("serializes detail app locale separately from language candidates", async () => {
    await realmApi.get("realm-1", {
      explicitLanguage: "ja",
      appLocale: "zh-hant",
      languages: ["en"],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/realm/realm-1?explicitLanguage=ja&appLocale=zh-hant&languages=en",
    );
  });
});
