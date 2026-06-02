import { beforeEach, describe, expect, mock, test } from "bun:test";
import { PostKind } from "@rezics/contract";
import { configureApi } from "../config";
import { postApi } from "./post.api";
import { postKeys } from "./post.keys";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("post wiki API helpers", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ posts: [], total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("lists WIKI posts scoped to a realm", async () => {
    await postApi.getWikiByRealm("realm-1", {
      limit: 20,
      sort: "new",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/post/list?limit=20&sort=new&realmUnitId=realm-1&kind=WIKI",
    );
  });

  test("requests moderation overlays for rendered post nodes", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ globalStates: [], realmOverlays: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await postApi.getModerationOverlays({
      realmUnitId: "realm-1",
      targetUnitIds: ["post-2", "post-1"],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/post/moderation-overlays",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      realmUnitId: "realm-1",
      targetUnitIds: ["post-2", "post-1"],
    });
    expect(
      postKeys.moderationOverlays("realm-1", ["post-2", "post-1"]),
    ).toEqual([
      "posts",
      "moderation-overlays",
      "realm-1",
      ["post-1", "post-2"],
    ]);
  });

  test("builds stable realm wiki keys", () => {
    expect(postKeys.wikiByRealm("realm-1", { limit: 20 })).toEqual([
      "posts",
      "realm",
      "realm-1",
      "wiki",
      { limit: 20 },
    ]);
  });

  test("builds stable variant context keys", () => {
    expect(postKeys.byVariant("variant-1", { limit: 20 })).toEqual([
      "posts",
      "variant",
      "variant-1",
      { limit: 20 },
    ]);
  });

  test("uses the shared WIKI kind literal", () => {
    expect(PostKind.WIKI).toBe("WIKI");
  });

  test("sends wiki body language on create and update helpers", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ unitId: "wiki-post-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await postApi.createWiki({
      title: "Wiki title",
      content: { body: "hello" } as never,
      language: "en",
    });
    await postApi.updateWikiContent("wiki-post-1", {
      title: "Edited title",
      content: { body: "edited" } as never,
      language: "ja",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({
        kind: "WIKI",
        language: "en",
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      patch: {
        post: {
          title: "Edited title",
          content: { body: "edited" },
          language: "ja",
        },
      },
    });
  });

  test("submits an authored post to a realm through the post endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ unitId: "post-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await postApi.submitToRealm("post-1", {
      realmUnitId: "realm-1",
      tagIds: ["tag-1"],
      publish: true,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/post/post-1/submit-to-realm",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      realmUnitId: "realm-1",
      tagIds: ["tag-1"],
      publish: true,
    });
  });
});
