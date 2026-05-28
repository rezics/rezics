import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { translationGroupApi } from "./translation-group.api";
import { translationGroupKeys } from "./translation-group.keys";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("translationGroupApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ posts: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("resolves best-language wiki posts", async () => {
    await translationGroupApi.bestLanguageWikiPosts({
      translationGroupIds: ["tg-1", "tg-2"],
      preferredLanguages: ["ja", "en"],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/translation-group/wiki-posts/best",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        translationGroupIds: ["tg-1", "tg-2"],
        preferredLanguages: ["ja", "en"],
      }),
    });
  });

  test("builds stable best-language wiki post keys", () => {
    expect(
      translationGroupKeys.bestWikiPosts(["tg-2", "tg-1"], ["ja"]),
    ).toEqual([
      "translation-group",
      "wiki-posts",
      "best",
      ["tg-1", "tg-2"],
      ["ja"],
    ]);
  });
});
