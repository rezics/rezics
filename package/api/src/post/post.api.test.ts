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

  test("builds stable realm wiki keys", () => {
    expect(postKeys.wikiByRealm("realm-1", { limit: 20 })).toEqual([
      "posts",
      "realm",
      "realm-1",
      "wiki",
      { limit: 20 },
    ]);
  });

  test("uses the shared WIKI kind literal", () => {
    expect(PostKind.WIKI).toBe("WIKI");
  });
});
