import { describe, expect, test } from "bun:test";
import type { ZoneSection } from "@rezics/contract";
import {
  ZONE_SECTION_KINDS,
  zoneHomePage,
  zoneHomeSections,
  zoneSectionPrimitive,
} from "./zoneSections";

const manualSection: ZoneSection = {
  id: "intro",
  kind: "manualContent",
  body: {
    kind: "markdown",
    markdown: "Welcome",
  },
};

const latestSection: ZoneSection = {
  id: "latest",
  kind: "latestContent",
};

describe("zone section resolution", () => {
  test("prefers the typed home page sections over legacy root sections", () => {
    const page = zoneHomePage({
      pages: {
        home: {
          title: {
            translations: { en: "Home" },
          },
          sections: [manualSection],
        },
      },
      sections: [latestSection],
    });

    expect(page?.sections).toEqual([manualSection]);
    expect(zoneHomeSections({ pages: page ? { home: page } : null })).toEqual([
      manualSection,
    ]);
  });

  test("falls back to legacy zone sections during the development cutover", () => {
    expect(
      zoneHomeSections({
        pages: null,
        sections: [latestSection],
      }),
    ).toEqual([latestSection]);
  });

  test("returns an empty section list when the zone has no home config", () => {
    expect(zoneHomeSections({ pages: null, sections: null })).toEqual([]);
  });

  test("classifies every zone homepage section kind into a renderer primitive", () => {
    expect(ZONE_SECTION_KINDS).toEqual([
      "latestContent",
      "popularContent",
      "feed",
      "reviewStream",
      "shelfCarousel",
      "realmList",
      "tagNavigation",
      "wikiCollection",
      "manualContent",
    ]);
    expect(zoneSectionPrimitive({ kind: "manualContent" })).toBe(
      "manualContent",
    );
    expect(zoneSectionPrimitive({ kind: "manualLinks" })).toBe(
      "configuredLinkList",
    );
    expect(zoneSectionPrimitive({ kind: "realmList" })).toBe(
      "configuredLinkList",
    );
    expect(zoneSectionPrimitive({ kind: "tagNavigation" })).toBe(
      "configuredLinkList",
    );
    expect(zoneSectionPrimitive({ kind: "wikiCollection" })).toBe(
      "configuredLinkList",
    );
    expect(zoneSectionPrimitive({ kind: "shelfCarousel" })).toBe(
      "configuredLinkList",
    );
    expect(zoneSectionPrimitive({ kind: "latestContent" })).toBe(
      "zoneScopedData",
    );
    expect(zoneSectionPrimitive({ kind: "popularContent" })).toBe(
      "zoneScopedData",
    );
    expect(zoneSectionPrimitive({ kind: "feed" })).toBe("zoneScopedData");
    expect(zoneSectionPrimitive({ kind: "reviewStream" })).toBe(
      "zoneScopedData",
    );
  });
});
