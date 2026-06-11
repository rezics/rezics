import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  ZoneBoundary,
  ZoneNav,
  ZonePage,
  ZoneTheme,
} from "@rezics/contract";
import { configureApi } from "../config";
import { zoneApi } from "./zone.api";
import { zoneKeys } from "./zone.keys";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

const boundary: ZoneBoundary = {
  schema: "rezics/zone-boundary",
  version: 1,
  context: { kind: "global" },
  filters: {},
};

const nav: ZoneNav = {
  schema: "rezics/zone-nav",
  version: 1,
  menus: [{ id: "main", nodes: [] }],
  header: { menuId: "main" },
};

const theme: ZoneTheme = {
  schema: "rezics/zone-theme",
  version: 1,
};

const homePage: ZonePage = {
  schema: "rezics/zone-page",
  version: 1,
  sections: [],
};

describe("zoneApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("fetches the zone by slug with language preferences", async () => {
    await zoneApi.getBySlug("toaru", ["zh-hant", "en"]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/zone/by-slug/toaru?languages=zh-hant%2Cen",
    );
  });

  test("fetches the portal bundle and per-section data with cursor", async () => {
    await zoneApi.getPortal("zone-1", "home", ["en"]);
    await zoneApi.getSection("zone-1", "page-home", "s-latest", {
      cursor: "24",
      languages: ["en"],
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://api.example/zone/zone-1/portal/home?languages=en",
      "http://api.example/zone/zone-1/page/page-home/section/s-latest?cursor=24&languages=en",
    ]);
  });

  test("sends shell envelopes on create and column updates", async () => {
    await zoneApi.create({
      slug: "toaru",
      ownerRealmUnitId: "realm-1",
      translations: [{ language: "en", title: "Toaru" }],
      boundary,
      nav,
      theme,
      homePage,
    });
    await zoneApi.updateBoundary("zone-1", { boundary });
    await zoneApi.updateNav("zone-1", { nav });
    await zoneApi.updateTheme("zone-1", { theme });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.example/zone");
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      slug: "toaru",
      ownerRealmUnitId: "realm-1",
      boundary: { schema: "rezics/zone-boundary", version: 1 },
      nav: { schema: "rezics/zone-nav", version: 1 },
      theme: { schema: "rezics/zone-theme", version: 1 },
      homePage: { schema: "rezics/zone-page", version: 1 },
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://api.example/zone/zone-1/boundary",
    );
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PATCH" });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "http://api.example/zone/zone-1/nav",
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "http://api.example/zone/zone-1/theme",
    );
  });

  test("sends page CRUD requests", async () => {
    await zoneApi.createPage("zone-1", {
      slug: "characters",
      config: homePage,
    });
    await zoneApi.updatePage("zone-1", "page-characters", {
      slug: "cast",
      config: homePage,
    });
    await zoneApi.deletePage("zone-1", "page-characters");

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://api.example/zone/zone-1/pages",
      "http://api.example/zone/zone-1/pages/page-characters",
      "http://api.example/zone/zone-1/pages/page-characters",
    ]);
    expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual([
      "POST",
      "PATCH",
      "DELETE",
    ]);
  });

  test("builds per-section keys scoped under the zone unit", () => {
    expect(zoneKeys.detail("toaru", ["en"])).toEqual([
      "zones",
      "detail",
      "toaru",
      ["en"],
    ]);
    expect(zoneKeys.portal("zone-1", "home", ["en"])).toEqual([
      "zones",
      "detail",
      "unit",
      "zone-1",
      "portal",
      "home",
      ["en"],
    ]);
    expect(zoneKeys.section("zone-1", "page-home", "s-latest", ["en"])).toEqual(
      [
        "zones",
        "detail",
        "unit",
        "zone-1",
        "section",
        "page-home",
        "s-latest",
        ["en"],
      ],
    );
  });
});
