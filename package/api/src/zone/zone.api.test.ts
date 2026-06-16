import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { zoneApi } from "./zone.api";
import { zoneKeys } from "./zone.keys";
import { invalidateZoneQueries } from "./zone.mutations";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("zoneApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          slug: "wiki-zone",
          name: "Wiki Zone",
          filters: {},
          template: "default",
          wiki: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("sends wiki config on zone update", async () => {
    await zoneApi.update("zone-1", {
      wiki: {
        filters: {
          realmUnitId: "realm-1",
          postKind: "WIKI",
        },
        theme: {
          template: "wiki-classic",
          homepageTemplate: "wiki-classic-home",
        },
      },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.example/zone/zone-1");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({
        wiki: {
          filters: {
            realmUnitId: "realm-1",
            postKind: "WIKI",
          },
          theme: {
            template: "wiki-classic",
            homepageTemplate: "wiki-classic-home",
          },
        },
      }),
    });
  });

  test("sends owner realm and versioned config on zone create", async () => {
    await zoneApi.create({
      slug: "library",
      translations: [{ language: "en", title: "Library" }],
      ownerRealmUnitId: "realm-1",
      filters: { type: "BOOK" },
      configVersion: 1,
      pages: {
        home: {
          sections: [{ id: "latest", kind: "latestContent" }],
        },
      },
      theme: {
        tokens: { accent: "#2f6fef" },
        layout: { contentWidth: "wide" },
      },
      primaryRealmUnitId: "realm-1",
      template: "default",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.example/zone");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        slug: "library",
        translations: [{ language: "en", title: "Library" }],
        ownerRealmUnitId: "realm-1",
        filters: { type: "BOOK" },
        configVersion: 1,
        pages: {
          home: {
            sections: [{ id: "latest", kind: "latestContent" }],
          },
        },
        theme: {
          tokens: { accent: "#2f6fef" },
          layout: { contentWidth: "wide" },
        },
        primaryRealmUnitId: "realm-1",
        template: "default",
      }),
    });
  });

  test("builds stable slug and Unit id keys", () => {
    expect(zoneKeys.detail("wiki-zone")).toEqual([
      "zones",
      "detail",
      "wiki-zone",
    ]);
    expect(zoneKeys.byUnitId("zone-1")).toEqual([
      "zones",
      "detail",
      "unit",
      "zone-1",
    ]);
    expect(zoneKeys.homepageByUnitId("zone-1", ["zh-Hant"])).toEqual([
      "zones",
      "detail",
      "unit",
      "zone-1",
      "homepage",
      ["zh-Hant"],
    ]);
  });

  test("fetches wiki homepage data with language preferences", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          template: "wiki-classic-home",
          sections: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await zoneApi.getHomepage("zone-1", ["zh-Hant", "en"]);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/zone/zone-1/homepage?languages=zh-Hant%2Cen",
    );
  });

  test("invalidates zone detail queries", () => {
    const queryClient = {
      invalidateQueries: mock(async () => undefined),
    };

    invalidateZoneQueries(queryClient, { slug: "wiki-zone" });

    expect(
      (queryClient.invalidateQueries.mock.calls as any[]).map(
        (call) => call[0],
      ),
    ).toEqual([
      { queryKey: ["zones", "detail"] },
      { queryKey: ["zones", "detail", "wiki-zone"] },
    ]);
  });
});
