import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  buildCanonicalUrl,
  createSourceSiteSchema,
  deriveSourceSiteCrawlStatus,
  isValidSourceRefRules,
  parseSourceUrl,
  sourceSiteRefRulesSchema,
} from "./site";
import { suggestExternalKinds } from "./external-kind";

const qidianRules = [
  {
    externalKind: "book",
    externalIdName: "bookId",
    urlTemplate: "https://book.qidian.com/info/{externalId}",
    urlMatchPattern: "^https://book\\.qidian\\.com/info/(?<externalId>[^/?#]+)",
    crawlerActionKey: "qidian.book",
    crawlSupported: true,
  },
  {
    externalKind: "publisher",
    externalIdName: "publisherId",
    urlTemplate: "https://www.qidian.com/publisher/{externalId}",
    urlMatchPattern:
      "^https://www\\.qidian\\.com/publisher/(?<externalId>[^/?#]+)",
  },
] as const;

describe("source site contract schemas", () => {
  test("accepts valid reference rules", () => {
    expect(Value.Check(sourceSiteRefRulesSchema, qidianRules)).toBe(true);
    expect(isValidSourceRefRules(qidianRules)).toBe(true);
  });

  test("rejects invalid reference rules", () => {
    expect(
      Value.Check(sourceSiteRefRulesSchema, [
        {
          externalIdName: "bookId",
          urlTemplate: "https://book.qidian.com/info/{externalId}",
          urlMatchPattern:
            "^https://book\\.qidian\\.com/info/(?<externalId>[^/?#]+)",
        },
      ]),
    ).toBe(false);

    expect(
      isValidSourceRefRules([
        {
          externalKind: "book",
          externalIdName: "bookId",
          urlTemplate: "https://book.qidian.com/info/static",
          urlMatchPattern:
            "^https://book\\.qidian\\.com/info/(?<externalId>[^/?#]+)",
        },
      ]),
    ).toBe(false);
  });

  test("rejects duplicated display fields on writes", () => {
    expect(
      Value.Check(createSourceSiteSchema, {
        entityUnitId: "entity-1",
        key: "qidian",
        crawlSupport: "supported",
        refRules: qidianRules,
        name: "Qidian",
      }),
    ).toBe(false);
  });

  test("derives crawl scheduling gates", () => {
    expect(
      deriveSourceSiteCrawlStatus({
        crawlSupport: "supported",
        crawlerAdapterKey: "qidian",
        crawlEnabled: false,
      }),
    ).toEqual({ supportsCrawl: true, canScheduleCrawl: false });

    expect(
      deriveSourceSiteCrawlStatus({
        crawlSupport: "planned",
        crawlEnabled: true,
      }),
    ).toEqual({ supportsCrawl: false, canScheduleCrawl: false });

    expect(
      deriveSourceSiteCrawlStatus({
        crawlSupport: "supported",
        crawlerAdapterKey: "qidian",
        crawlEnabled: true,
      }),
    ).toEqual({ supportsCrawl: true, canScheduleCrawl: true });
  });

  test("derives and parses source URLs", () => {
    expect(
      buildCanonicalUrl("https://book.qidian.com/info/{externalId}", "123"),
    ).toBe("https://book.qidian.com/info/123");

    expect(
      parseSourceUrl(
        "https://book.qidian.com/info/123?from=share",
        qidianRules,
      ),
    ).toMatchObject({
      externalKind: "book",
      externalId: "123",
    });
  });

  test("suggests external kinds without filtering available kinds", () => {
    expect(suggestExternalKinds("BOOK", ["publisher", "book"])).toEqual([
      "book",
      "publisher",
    ]);
  });
});
