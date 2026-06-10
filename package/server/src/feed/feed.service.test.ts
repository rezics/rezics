import { beforeEach, describe, expect, mock, test } from "bun:test";

let listResult = {
  posts: [
    {
      unitId: "post-1",
      authorUserId: "user-1",
      kind: "POST",
      createdAt: "2026-06-05T00:00:00.000Z",
    },
  ],
  total: 1,
};

let byRealmResult = {
  posts: [
    {
      unitId: "review-1",
      authorUserId: "user-1",
      kind: "REVIEW",
      targetUnitId: "book-1",
      extra: { book: { id: "book-1", title: "Book One" } },
      createdAt: "2026-06-05T01:00:00.000Z",
      feedSortValue: 42,
    },
  ],
  total: 1,
};

let bookListResult = {
  books: [
    { unitId: "book-1", title: "Book One", coverUrl: "book-1.jpg" },
    { unitId: "book-2", title: "Book Two", coverUrl: "book-2.jpg" },
  ],
  total: 2,
};

let shelfListResult = {
  shelves: [
    { unitId: "shelf-1", title: "Shelf One", itemCount: 3 },
    { unitId: "shelf-2", title: "Shelf Two", itemCount: 5 },
  ],
  total: 2,
};

let zoneResult: any = {
  unitId: "zone-1",
  filters: {
    realmUnitId: "realm-1",
    tags: [{ unitId: "tag-1" }],
    postKind: "REVIEW",
    languages: ["en"],
  },
};

const listMock = mock(async () => listResult);
const byRealmMock = mock(async () => byRealmResult);
const bookListMock = mock(async () => bookListResult);
const shelfListMock = mock(async () => shelfListResult);
const zoneGetByUnitIdMock = mock(async () => zoneResult);
const mapPostToDTOMock = mock((post) => post);
const hydrateVariantContextSummariesMock = mock(async () => new Map());
const resolveEffectiveReadLanguageCandidatesMock = mock(
  (input?: { languages?: string | readonly string[] | null }) => {
    const raw = input?.languages;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") return raw.split(",").filter(Boolean);
    return [];
  },
);
const realmGetByUnitIdMock = mock(async (unitId: string) => ({
  unitId,
  slug: "realm-one",
  title: "Realm One",
}));

mock.module("@/post", () => ({
  postService: {
    list: listMock,
    byRealm: byRealmMock,
  },
}));

mock.module("@/post/post.mapper", () => ({
  mapPostToDTO: mapPostToDTOMock,
}));

mock.module("@/unit/variant-context", () => ({
  hydrateVariantContextSummaries: hydrateVariantContextSummariesMock,
}));

mock.module("@/unit/language-resolution", () => ({
  resolveEffectiveReadLanguageCandidates:
    resolveEffectiveReadLanguageCandidatesMock,
}));

mock.module("@/realm", () => ({
  realmService: {
    getByUnitId: realmGetByUnitIdMock,
  },
}));

mock.module("@/book", () => ({
  bookService: {
    list: bookListMock,
  },
}));

mock.module("@/shelf", () => ({
  shelfService: {
    list: shelfListMock,
  },
}));

mock.module("@/zone", () => ({
  zoneService: {
    getByUnitId: zoneGetByUnitIdMock,
  },
}));

mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    statusCode: number;

    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

beforeEach(() => {
  listResult = {
    posts: [
      {
        unitId: "post-1",
        authorUserId: "user-1",
        kind: "POST",
        createdAt: "2026-06-05T00:00:00.000Z",
      },
    ],
    total: 1,
  };
  byRealmResult = {
    posts: [
      {
        unitId: "review-1",
        authorUserId: "user-1",
        kind: "REVIEW",
        targetUnitId: "book-1",
        extra: { book: { id: "book-1", title: "Book One" } },
        createdAt: "2026-06-05T01:00:00.000Z",
        feedSortValue: 42,
      },
    ],
    total: 1,
  };
  bookListResult = {
    books: [
      { unitId: "book-1", title: "Book One", coverUrl: "book-1.jpg" },
      { unitId: "book-2", title: "Book Two", coverUrl: "book-2.jpg" },
    ],
    total: 2,
  };
  shelfListResult = {
    shelves: [
      { unitId: "shelf-1", title: "Shelf One", itemCount: 3 },
      { unitId: "shelf-2", title: "Shelf Two", itemCount: 5 },
    ],
    total: 2,
  };
  zoneResult = {
    unitId: "zone-1",
    boundary: {
      schema: "rezics/zone-boundary",
      version: 1,
      context: { kind: "realm", realmUnitId: "realm-1" },
      filters: {
        postKinds: ["REVIEW"],
        languages: ["en"],
        tagUnitIds: ["tag-1"],
      },
    },
  };
  listMock.mockClear();
  byRealmMock.mockClear();
  bookListMock.mockClear();
  shelfListMock.mockClear();
  zoneGetByUnitIdMock.mockClear();
  mapPostToDTOMock.mockClear();
  hydrateVariantContextSummariesMock.mockClear();
  resolveEffectiveReadLanguageCandidatesMock.mockClear();
  realmGetByUnitIdMock.mockClear();
});

describe("FeedService", () => {
  test("builds home content rows from post list", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    const result = await service.list({
      scope: "home",
      sort: "best",
      limit: 1,
    });

    expect(listMock).toHaveBeenCalledWith(
      {
        sort: "hot",
        cursor: undefined,
        limit: 1,
      },
      undefined,
    );
    expect(result.rows[0]).toMatchObject({
      type: "content",
      rowId: "post:post-1",
      href: "/post/post-1",
    });
    expect(result.nextCursor).toEqual({
      rowId: "post:post-1",
      createdAt: "2026-06-05T00:00:00.000Z",
    });
  });

  test("schedules home carousels sparsely from bounded work and shelf rows", async () => {
    listResult = {
      posts: Array.from({ length: 8 }, (_, index) => ({
        unitId: `post-${index + 1}`,
        authorUserId: "user-1",
        kind: "POST",
        createdAt: `2026-06-05T00:0${index}:00.000Z`,
      })),
      total: 8,
    };
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    const result = await service.list({
      scope: "home",
      sort: "best",
      limit: 8,
    });

    expect(bookListMock).toHaveBeenCalledWith({ limit: 8 });
    expect(shelfListMock).toHaveBeenCalledWith({ limit: 8 });
    expect(result.rows.map((row) => row.type)).toEqual([
      "content",
      "content",
      "content",
      "content",
      "carousel",
      "content",
      "content",
      "content",
      "content",
    ]);
    expect(result.rows[4]).toMatchObject({
      type: "carousel",
      carouselKind: "works",
    });
    expect(
      result.rows[4]?.type === "carousel" && result.rows[4].works?.[0],
    ).toMatchObject({ unitId: "book-1", title: "Book One" });
    expect(result.nextCursor).toEqual({
      rowId: "post:post-8",
      createdAt: "2026-06-05T00:07:00.000Z",
    });
  });

  test("skips carousels on cursor pages and when data is insufficient", async () => {
    listResult = {
      posts: Array.from({ length: 5 }, (_, index) => ({
        unitId: `post-${index + 1}`,
        authorUserId: "user-1",
        kind: "POST",
        createdAt: `2026-06-05T00:0${index}:00.000Z`,
      })),
      total: 5,
    };
    bookListResult = {
      books: [{ unitId: "book-1", title: "Book One", coverUrl: "" }],
      total: 1,
    };
    shelfListResult = { shelves: [], total: 0 };
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    const firstPage = await service.list({ scope: "home", limit: 5 });
    const cursorPage = await service.list({
      scope: "home",
      limit: 5,
      cursor: { rowId: "post:post-5" },
    });

    expect(firstPage.rows.every((row) => row.type === "content")).toBe(true);
    expect(cursorPage.rows.every((row) => row.type === "content")).toBe(true);
    expect(bookListMock).toHaveBeenCalledTimes(1);
    expect(shelfListMock).toHaveBeenCalledTimes(1);
  });

  test("passes feed cursors through to the post source", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    await service.list({
      scope: "home",
      sort: "new",
      cursor: {
        rowId: "post:post-cursor",
        createdAt: "2026-06-05T00:00:00.000Z",
      },
      limit: 10,
    });

    expect(listMock).toHaveBeenCalledWith(
      {
        sort: "new",
        cursor: {
          unitId: "post-cursor",
          sortValue: undefined,
          createdAt: "2026-06-05T00:00:00.000Z",
        },
        limit: 10,
      },
      undefined,
    );
  });

  test("builds realm content rows from realm post list", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    const result = await service.list({
      scope: "realm",
      realmUnitId: "realm-1",
      sort: "top",
    });

    expect(byRealmMock).toHaveBeenCalledWith(
      "realm-1",
      {
        sort: "top",
        cursor: undefined,
        limit: 20,
      },
      undefined,
    );
    expect(result.rows[0]).toMatchObject({
      href: "/realm/realm-1/post/review-1",
      realm: { unitId: "realm-1", title: "Realm One" },
      targetUnit: { unitId: "book-1", title: "Book One" },
    });
  });

  test("builds zone rows from zone filter-backed post list", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    const result = await service.list({
      scope: "zone",
      zoneUnitId: "zone-1",
      tagIds: ["tag-2"],
      sort: "new",
      limit: 10,
    });

    expect(zoneGetByUnitIdMock).toHaveBeenCalledWith("zone-1");
    expect(listMock).toHaveBeenCalledWith(
      {
        sort: "new",
        cursor: undefined,
        limit: 10,
        realmUnitId: "realm-1",
        kind: "REVIEW",
        languages: "en",
        tagIds: ["tag-2", "tag-1"],
      },
      undefined,
    );
    expect(result.scope).toBe("zone");
    expect(result.rows[0]).toMatchObject({
      type: "content",
      rowId: "post:post-1",
      recommendationReason: "zone-feed-activity",
    });
    expect(byRealmMock).not.toHaveBeenCalled();
  });

  test("rejects zone feed without a zone Unit id", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    await expect(service.list({ scope: "zone" })).rejects.toMatchObject({
      statusCode: 400,
      message: "zoneUnitId is required for zone feed",
    });
  });

  test("rejects missing zone feed targets", async () => {
    zoneResult = null;
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    await expect(
      service.list({ scope: "zone", zoneUnitId: "missing-zone" }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Zone not found",
    });
  });

  test("builds book library rows from review posts", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    const result = await service.list({
      scope: "library",
      libraryKind: "book",
      sort: "new",
      limit: 10,
    });

    expect(listMock).toHaveBeenCalledWith(
      {
        sort: "new",
        cursor: undefined,
        limit: 10,
        kind: "REVIEW",
      },
      undefined,
    );
    expect(result).toMatchObject({
      scope: "library",
      rows: [{ recommendationReason: "book-library-review" }],
    });
  });

  test("uses targeted book library feeds for book community surfaces", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    const result = await service.list({
      scope: "library",
      libraryKind: "book",
      targetUnitId: "book-1",
      languages: ["ja", "en"],
      languageMode: "preferred",
      sort: "best",
    });

    expect(listMock).toHaveBeenCalledWith(
      {
        sort: "hot",
        cursor: undefined,
        limit: 20,
        targetUnitId: "book-1",
        languages: ["ja", "en"],
        languageMode: "preferred",
      },
      undefined,
    );
    expect(result.rows[0]).toMatchObject({
      recommendationReason: "book-library-activity",
    });
  });

  test("rejects unsupported library feed kinds", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    await expect(
      service.list({ scope: "library", libraryKind: "game" }),
    ).rejects.toThrow("Only book library feeds are supported");
  });

  test("emits ranked cursor values when realm source provides them", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    const result = await service.list({
      scope: "realm",
      realmUnitId: "realm-1",
      sort: "top",
      limit: 1,
    });

    expect(result.nextCursor).toEqual({
      rowId: "post:review-1",
      sortValue: 42,
      createdAt: "2026-06-05T01:00:00.000Z",
    });
  });

  test("requires realmUnitId for realm scope", async () => {
    const { FeedService } = await import("./feed.service");
    const service = new FeedService();

    await expect(service.list({ scope: "realm" })).rejects.toThrow(
      "realmUnitId is required",
    );
  });
});
