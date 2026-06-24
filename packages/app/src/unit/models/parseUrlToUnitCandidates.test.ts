import { describe, expect, test } from "bun:test";
import type {
  GetMatchedRoutes,
  MatchedRoutesResult,
} from "./parseUrlToUnitCandidates";
import { parseUrlToUnitCandidates } from "./parseUrlToUnitCandidates";

function makeGetMatchedRoutes(
  byPathname: Record<string, MatchedRoutesResult>,
): GetMatchedRoutes {
  return (pathname: string) => {
    const found = byPathname[pathname];
    if (found) return found;
    return {
      matchedRoutes: [],
      routeParams: {},
      parseError: new Error("no match"),
    };
  };
}

describe("parseUrlToUnitCandidates", () => {
  test("single-id URL returns one candidate", () => {
    const get = makeGetMatchedRoutes({
      "/shelf/s-123": {
        matchedRoutes: [
          { fullPath: "/" },
          { fullPath: "/_mainLayout" },
          { fullPath: "/shelf/$shelfId" },
        ],
        routeParams: { shelfId: "s-123" },
      },
    });
    const candidates = parseUrlToUnitCandidates(get, "/shelf/s-123");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      kind: "shelf",
      identifier: "s-123",
      identifierType: "id",
    });
  });

  test("URL with two ids puts chapter (deepest) first", () => {
    const get = makeGetMatchedRoutes({
      "/book/abc/read/xyz": {
        matchedRoutes: [
          { fullPath: "/" },
          { fullPath: "/book/$bookId" },
          { fullPath: "/book/$bookId/read/$chapterId" },
        ],
        routeParams: { bookId: "abc", chapterId: "xyz" },
      },
    });
    const candidates = parseUrlToUnitCandidates(get, "/book/abc/read/xyz");
    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({ kind: "chapter", identifier: "xyz" });
    expect(candidates[1]).toMatchObject({ kind: "book", identifier: "abc" });
  });

  test("slug URL emits slug-type candidate", () => {
    const get = makeGetMatchedRoutes({
      "/unit/some-readable-slug": {
        matchedRoutes: [{ fullPath: "/unit/$unitSlug" }],
        routeParams: { unitSlug: "some-readable-slug" },
      },
    });
    const candidates = parseUrlToUnitCandidates(
      get,
      "/unit/some-readable-slug",
    );
    expect(candidates[0]).toMatchObject({
      kind: "unit",
      identifier: "some-readable-slug",
      identifierType: "slug",
    });
  });

  test("unparseable input returns empty array", () => {
    const get = makeGetMatchedRoutes({});
    expect(parseUrlToUnitCandidates(get, "")).toEqual([]);
    expect(parseUrlToUnitCandidates(get, "not a url")).toEqual([]);
    expect(parseUrlToUnitCandidates(get, "/nothing")).toEqual([]);
  });

  test("strips search and hash before matching", () => {
    const get = makeGetMatchedRoutes({
      "/shelf/s-1": {
        matchedRoutes: [{ fullPath: "/shelf/$shelfId" }],
        routeParams: { shelfId: "s-1" },
      },
    });
    const candidates = parseUrlToUnitCandidates(
      get,
      "/shelf/s-1?foo=bar#section",
    );
    expect(candidates[0]?.identifier).toBe("s-1");
  });

  test("strips http(s) origin before matching", () => {
    const get = makeGetMatchedRoutes({
      "/shelf/s-1": {
        matchedRoutes: [{ fullPath: "/shelf/$shelfId" }],
        routeParams: { shelfId: "s-1" },
      },
    });
    const candidates = parseUrlToUnitCandidates(
      get,
      "https://app.example.com/shelf/s-1",
    );
    expect(candidates[0]?.identifier).toBe("s-1");
  });

  test("parseError yields empty candidates", () => {
    const get: GetMatchedRoutes = () => ({
      matchedRoutes: [],
      routeParams: {},
      parseError: new Error("invalid"),
    });
    expect(parseUrlToUnitCandidates(get, "/anything")).toEqual([]);
  });
});
