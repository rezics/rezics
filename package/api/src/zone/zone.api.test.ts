import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ZoneConfig } from "@rezics/contract";
import { configureApi } from "../config";
import { zoneApi } from "./zone.api";
import { zoneKeys } from "./zone.keys";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

const config: ZoneConfig = {
  schema: "rezics/zone-config",
  version: 1,
  context: { kind: "global" },
  filters: {},
  menus: [{ id: "main", nodes: [] }],
  header: { menuId: "main" },
  pages: { home: { sections: [] } },
  theme: {},
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
    await zoneApi.getPortal("zone-1", ["en"]);
    await zoneApi.getSection("zone-1", "s-latest", {
      cursor: "24",
      languages: ["en"],
    });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://api.example/zone/zone-1/portal?languages=en",
      "http://api.example/zone/zone-1/section/s-latest?cursor=24&languages=en",
    ]);
  });

  test("sends the versioned config envelope on create and update", async () => {
    await zoneApi.create({
      slug: "toaru",
      ownerRealmUnitId: "realm-1",
      translations: [{ language: "en", title: "Toaru Wiki" }],
      config,
    });
    await zoneApi.update("zone-1", { config });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.example/zone");
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      slug: "toaru",
      ownerRealmUnitId: "realm-1",
      config: { schema: "rezics/zone-config", version: 1 },
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://api.example/zone/zone-1");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PATCH" });
  });

  test("builds per-section keys scoped under the zone unit", () => {
    expect(zoneKeys.detail("toaru", ["en"])).toEqual([
      "zones",
      "detail",
      "toaru",
      ["en"],
    ]);
    expect(zoneKeys.portal("zone-1", ["en"])).toEqual([
      "zones",
      "detail",
      "unit",
      "zone-1",
      "portal",
      ["en"],
    ]);
    expect(zoneKeys.section("zone-1", "s-latest", ["en"])).toEqual([
      "zones",
      "detail",
      "unit",
      "zone-1",
      "section",
      "s-latest",
      ["en"],
    ]);
  });
});
