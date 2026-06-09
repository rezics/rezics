import { describe, expect, test } from "bun:test";
import type { ZoneSection } from "@rezics/contract";
import { zoneHomePage, zoneHomeSections } from "./zoneSections";

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
});
