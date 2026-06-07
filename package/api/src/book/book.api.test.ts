import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { bookApi } from "./book.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("bookApi read language queries", () => {
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

  test("serializes detail read language context", async () => {
    await bookApi.get("book-1", {
      appLocale: "zh-hant",
      languages: ["en", "ja"],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/book/book-1?appLocale=zh-hant&languages=en%2Cja",
    );
  });

  test("serializes list app locale separately from language candidates", async () => {
    await bookApi.list({
      appLocale: "zh-hant",
      languages: ["en", "ja"],
      languageMode: "preferred",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/book/list?appLocale=zh-hant&languages=en%2Cja&languageMode=preferred",
    );
  });
});
