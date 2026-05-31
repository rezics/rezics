import { beforeEach, describe, expect, mock, test } from "bun:test";
import { markdownContentDoc } from "@rezics/contract";
import { bookApi } from "./book/book.api";
import { configureApi } from "./config";
import { entityApi } from "./entity/entity.api";
import { historyApi } from "./history/history.api";
import { historyKeys } from "./history/history.keys";
import { postApi } from "./post/post.api";
import { postKeys } from "./post/post.keys";
import { ApiError, getLockedFieldError } from "./react-query/errors";
import { shelfKeys } from "./shelf/shelf.keys";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("content authority and history API clients", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(ok({}));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("creation helpers submit creationMode without owner ids", async () => {
    await bookApi.createWiki({ title: "Catalog Book" } as never);
    await bookApi.createPersonal({ title: "My Book" } as never);
    await entityApi.createWiki({ name: "Author" } as never);

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      title: "Catalog Book",
      creationMode: "wiki",
    });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      title: "My Book",
      creationMode: "personal",
    });
    expect(JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string)).toEqual({
      name: "Author",
      creationMode: "wiki",
    });
  });

  test("book create forwards creation work match payload", async () => {
    await bookApi.create({
      creationMode: "wiki",
      workMatch: { releaseUnitId: "release-1" },
      translations: [{ language: "en", title: "New Release" }],
    });

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      creationMode: "wiki",
      workMatch: { releaseUnitId: "release-1" },
      translations: [{ language: "en", title: "New Release" }],
    });
  });

  test("wiki post helpers pin kind and creation mode", async () => {
    const content = markdownContentDoc("body");
    const edited = markdownContentDoc("edited");

    await postApi.createWiki({
      content,
      targetUnitId: "book-1",
    } as never);
    await postApi.updateWikiContent("post-1", edited);
    await postApi.getWikiByTarget("book-1", { limit: 5 });
    await postApi.getByWork("work-1", { limit: 5, workRoles: ["POST"] });

    expect(
      JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
    ).toMatchObject({
      content,
      targetUnitId: "book-1",
      kind: "WIKI",
      creationMode: "wiki",
    });
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string)).toEqual({
      patch: { post: {} },
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "http://api.example/post/list?limit=5&targetUnitId=book-1&kind=WIKI",
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "http://api.example/post/list?workUnitId=work-1&limit=5&workRoles=%5B%22POST%22%5D",
    );
  });

  test("history clients use service base URL and stable query keys", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ revisions: [], nextCursor: null }))
      .mockResolvedValueOnce(
        ok({
          revision: {
            id: "rev-1",
            unitId: "unit-1",
            sequence: 1,
            contentHash: "hash",
            actorUserId: "actor-1",
            changedFieldKeys: ["translations.en.title"],
            createdAt: "2026-05-19T00:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(ok({ events: [], nextCursor: null }))
      .mockResolvedValueOnce(
        ok({
          event: {
            id: "event-1",
            unitId: "unit-1",
            sequence: 2,
            eventType: "book.contentStructure.batch",
            actorUserId: "actor-1",
            changedFieldKeys: ["book.contentStructure"],
            createdAt: "2026-05-19T00:00:00.000Z",
            payload: { operations: [] },
          },
        }),
      )
      .mockResolvedValueOnce(ok({ actors: {} }))
      .mockResolvedValueOnce(ok({ units: {} }))
      .mockResolvedValueOnce(
        ok({
          revision: {
            id: "rev-0",
            unitId: "unit-1",
            sequence: 0,
            contentHash: "hash-0",
            actorUserId: "actor-1",
            changedFieldKeys: ["translations.en.title"],
            createdAt: "2026-05-19T00:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        ok({
          revision: {
            id: "rev-1",
            unitId: "unit-1",
            sequence: 1,
            contentHash: "hash-1",
            actorUserId: "actor-1",
            changedFieldKeys: ["translations.en.title"],
            createdAt: "2026-05-19T00:00:00.000Z",
          },
        }),
      );

    await historyApi.listUnitRevisions("unit-1", {
      cursor: "c 1",
      limit: 10,
      includeContent: false,
    });
    await historyApi.getUnitRevision("unit-1", 1, { includeContent: true });
    await historyApi.listStructureEvents("unit-1", {
      eventType: "book.contentStructure.batch",
      includePayload: false,
    });
    await historyApi.getStructureEvent(
      "unit-1",
      2,
      "book.contentStructure.batch",
      { includePayload: true },
    );
    await historyApi.resolveActors(["actor-1"]);
    await historyApi.resolveUnitReferences(["unit-1"]);
    await historyApi.getRevisionCompareInput("unit-1", 0, 1);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/history/unit/unit-1/revisions?cursor=c+1&limit=10&includeContent=false",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://api.example/history/unit/unit-1/revisions/1?includeContent=true",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "http://api.example/history/unit/unit-1/structure-events?eventType=book.contentStructure.batch&includePayload=false",
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "http://api.example/history/unit/unit-1/structure-events/2/book.contentStructure.batch?includePayload=true",
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      "http://api.example/history/resolve/actors",
    );
    expect(JSON.parse(fetchMock.mock.calls[4]?.[1]?.body as string)).toEqual({
      ids: ["actor-1"],
    });
    expect(fetchMock.mock.calls[5]?.[0]).toBe(
      "http://api.example/history/resolve/units",
    );
    expect(historyKeys.revisions("unit-1", { limit: 10 })).toEqual([
      "history",
      "unit",
      "unit-1",
      "revisions",
      { limit: 10 },
    ]);
    expect(historyKeys.actorResolution(["b", "a"])).toEqual([
      "history",
      "resolve",
      "actors",
      ["a", "b"],
    ]);
    expect(historyKeys.compare("unit-1", 0, 1)).toEqual([
      "history",
      "unit",
      "unit-1",
      "compare",
      0,
      1,
    ]);
    expect(postKeys.wikiByTarget("book-1", { limit: 5 })).toEqual([
      "posts",
      "target",
      "book-1",
      "wiki",
      { limit: 5 },
    ]);
    expect(postKeys.byWork("work-1", { limit: 5 })).toEqual([
      "posts",
      "work",
      "work-1",
      { limit: 5 },
    ]);
    expect(shelfKeys.containingUnit("release-1", { limit: 5 })).toEqual([
      "shelves",
      "list",
      "containsUnit",
      "release-1",
      { limit: 5 },
    ]);
  });

  test("locked-field errors map to actionable metadata", () => {
    const mapped = getLockedFieldError(
      new ApiError(403, "FIELD_LOCKED", "One or more fields are locked.", {
        unitId: "unit-1",
        blockedPaths: ["post.content.main"],
        offendingLockPath: "post.content.main",
        offendingPatchPath: "post.content.main.source",
      }),
    );

    expect(mapped).toEqual({
      unitId: "unit-1",
      blockedPaths: ["post.content.main"],
      offendingLockPath: "post.content.main",
      offendingPatchPath: "post.content.main.source",
      message: "One or more fields are locked.",
      locks: undefined,
    });
    expect(getLockedFieldError(new Error("nope"))).toBeNull();
  });

  test("history DTO payloads keep timeline and single revision shape", () => {
    const revision = {
      id: "rev-1",
      unitId: "unit-1",
      sequence: 1,
      contentHash: "hash",
      actorUserId: "actor-1",
      changedFieldKeys: ["translations.en.title"],
      createdAt: "2026-05-19T00:00:00.000Z",
      content: {
        hash: "hash",
        payload: { translations: { en: { title: "A" } } },
        createdAt: "2026-05-19T00:00:00.000Z",
      },
    };

    const timeline = { revisions: [revision], nextCursor: null };
    const single = { revision };

    expect(timeline.revisions[0]?.changedFieldKeys).toEqual([
      "translations.en.title",
    ]);
    expect(single.revision.content?.payload).toEqual({
      translations: { en: { title: "A" } },
    });
  });
});
