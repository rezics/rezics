import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

let currentIdentity = {
  sub: "user-1",
  userId: "user-1",
  permission: { role: "USER" },
};
let policyAllowed = false;
const decideForIdentityMock = mock(async () => ({
  allowed: policyAllowed,
  code: policyAllowed ? "ALLOWED" : "MISSING_CAPABILITY",
  safeMessage: policyAllowed ? "Allowed" : "Denied by policy",
}));
const createZoneMock = mock(async (input: unknown) => ({
  ...zoneStub,
  input,
}));
const updateZoneMock = mock(async (unitId: string, input: unknown) => ({
  ...zoneStub,
  unitId,
  input,
}));
const updateBoundaryMock = mock(async (unitId: string, boundary: unknown) => ({
  ...zoneStub,
  unitId,
  boundary,
}));
const updateNavMock = mock(async (unitId: string, nav: unknown) => ({
  ...zoneStub,
  unitId,
  nav,
}));
const updateThemeMock = mock(async (unitId: string, theme: unknown) => ({
  ...zoneStub,
  unitId,
  theme,
}));
const createPageMock = mock(async (unitId: string, page: unknown) => ({
  ...zoneStub,
  unitId,
  page,
}));
const updatePageMock = mock(
  async (unitId: string, pageId: string, page: unknown) => ({
    ...zoneStub,
    unitId,
    pageId,
    page,
  }),
);
const deletePageMock = mock(async (unitId: string, pageId: string) => ({
  ...zoneStub,
  unitId,
  pageId,
}));
const deleteZoneMock = mock(async () => undefined);
const listByUserMock = mock(async () => ({ zones: [zoneStub], total: 1 }));
const sectionDataMock = mock(
  async (
    _unitId: string,
    _pageId: string,
    sectionId: string,
  ): Promise<unknown | null> =>
    sectionId === "s-known" ? { sectionId, items: [], nextCursor: null } : null,
);

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({
      identity: currentIdentity,
    }),
  }),
  tryResolveIdentity: async () => null,
  isAdminRole: () => false,
  verifyAdminFromDb: async () => true,
  verifyRootFromDb: async () => true,
}));

mock.module("@/governance", () => ({
  governanceRoutePolicyService: {
    decideForIdentity: decideForIdentityMock,
  },
  realmPolicyActions: {
    zoneManage: "zone.manage",
  },
}));

const zoneBoundaryStub = {
  schema: "rezics/zone-boundary",
  version: 1,
  context: { kind: "global" },
  filters: {},
};

const zoneNavStub = {
  schema: "rezics/zone-nav",
  version: 1,
  menus: [{ id: "main", nodes: [] }],
  header: { menuId: "main" },
};

const zoneThemeStub = {
  schema: "rezics/zone-theme",
  version: 1,
};

const zonePageStub = {
  schema: "rezics/zone-page",
  version: 1,
  sections: [],
};

const homePageStub = {
  id: "page-home",
  zoneUnitId: "zone-1",
  slug: "home",
  position: "a",
  config: zonePageStub,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

const zoneStub = {
  unitId: "zone-1",
  ownerRealmUnitId: "realm-1",
  slug: "featured",
  unit: { visibility: "PUBLIC", translations: [], supportLanguages: [] },
  boundary: zoneBoundaryStub,
  nav: zoneNavStub,
  theme: zoneThemeStub,
  homePageId: "page-home",
  pages: [homePageStub],
  startsAt: null,
  endsAt: null,
};

mock.module("./zone.mapper", () => ({
  mapZoneToDTO: (zone: unknown) => zone,
}));

class ZoneServiceStub {}

mock.module("./zone.service", () => ({
  ZoneService: ZoneServiceStub,
  zoneService: {
    create: createZoneMock,
    update: updateZoneMock,
    delete: deleteZoneMock,
    getByUnitId: async (unitId: string) => {
      if (unitId === "zone-1") return zoneStub;
      return null;
    },
    getBySlug: async (slug: string) => {
      if (slug === "featured") return zoneStub;
      return null;
    },
    listByUser: listByUserMock,
    getPageBySlug: async (_unitId: string, pageSlug: string) => {
      if (pageSlug === "home") return homePageStub;
      return null;
    },
    getPortalRefUnits: async () => ({
      "label-1": { unitId: "label-1", type: "LABEL", title: "Characters" },
    }),
    getSectionData: sectionDataMock,
    updateBoundary: updateBoundaryMock,
    updateNav: updateNavMock,
    updateTheme: updateThemeMock,
    createPage: createPageMock,
    updatePage: updatePageMock,
    deletePage: deletePageMock,
    checkLifecycle: () => null,
  },
}));

beforeEach(() => {
  currentIdentity = {
    sub: "user-1",
    userId: "user-1",
    permission: { role: "USER" },
  };
  policyAllowed = false;
  decideForIdentityMock.mockClear();
  createZoneMock.mockClear();
  updateZoneMock.mockClear();
  updateBoundaryMock.mockClear();
  updateNavMock.mockClear();
  updateThemeMock.mockClear();
  createPageMock.mockClear();
  updatePageMock.mockClear();
  deletePageMock.mockClear();
  deleteZoneMock.mockClear();
  listByUserMock.mockClear();
  sectionDataMock.mockClear();
});

afterAll(() => {
  mock.restore();
});

describe("GET /zone/by-slug/:slug", () => {
  test("lists my zones with the requested view", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/me?view=managing&languages=en"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(listByUserMock).toHaveBeenCalledWith({
      userUnitId: "user-1",
      view: "managing",
      start: undefined,
      limit: 20,
    });
  });

  test("lists public user zones with public-only filtering", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/user/user-2?view=subscribed"),
    );

    expect(res.status).toBe(200);
    expect(listByUserMock).toHaveBeenCalledWith({
      userUnitId: "user-2",
      view: "subscribed",
      publicOnly: true,
      start: undefined,
      limit: 20,
    });
  });

  test("returns zone when slug resolves to ZONE", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/by-slug/featured"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ...zoneStub,
      pages: [
        {
          ...homePageStub,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  test("returns 404 when slug does not exist or resolves to non-zone", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/by-slug/does-not-exist"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /zone/:unitId/portal/:pageSlug", () => {
  test("returns the zone plus batch ref-unit summaries", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1/portal/home?languages=zh-hant"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zone.unitId).toBe("zone-1");
    expect(body.page.id).toBe("page-home");
    expect(body.refUnits["label-1"].title).toBe("Characters");
  });

  test("404s for unknown zones", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/zone-x/portal/home"),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /zone/:unitId/page/:pageId/section/:sectionId", () => {
  test("executes a section with cursor and languages", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request(
        "http://localhost/zone/zone-1/page/page-home/section/s-known?cursor=12&languages=en",
      ),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sectionId: "s-known",
      items: [],
      nextCursor: null,
    });
    expect(sectionDataMock).toHaveBeenCalledWith(
      "zone-1",
      "page-home",
      "s-known",
      {
        cursor: "12",
        preferredLanguages: ["en"],
      },
    );
  });

  test("404s for unknown section ids", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request(
        "http://localhost/zone/zone-1/page/page-home/section/s-unknown",
      ),
    );
    expect(res.status).toBe(404);
  });
});

describe("zone mutation policy", () => {
  const createBody = {
    slug: "new-zone",
    translations: [{ language: "en", title: "New Zone" }],
    ownerRealmUnitId: "realm-1",
    boundary: zoneBoundaryStub,
    nav: zoneNavStub,
    theme: zoneThemeStub,
    homePage: zonePageStub,
  };

  test("denies zone creation rejected by the owner realm policy", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createBody),
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.text()).toBe("Denied by policy");
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "zone.manage",
      target: {
        kind: "zone",
        id: "new",
        realmUnitId: "realm-1",
      },
    });
    expect(createZoneMock).not.toHaveBeenCalled();
  });

  test("allows zone creation approved by the owner realm policy", async () => {
    policyAllowed = true;

    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createBody),
      }),
    );

    expect(res.status).toBe(200);
    expect(createZoneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        ownerRealmUnitId: "realm-1",
        boundary: zoneBoundaryStub,
        nav: zoneNavStub,
        theme: zoneThemeStub,
        homePage: zonePageStub,
      }),
    );
  });

  test("write bodies are normalized to the strict envelope shape", async () => {
    policyAllowed = true;

    const { zoneApi } = await import("./zone.api");
    // Elysia normalizes additionalProperties away before the handler, so
    // legacy keys never reach persistence.
    // Elysia 在 handler 之前会按 additionalProperties 归一化，因此旧键
    // 绝不会进入持久化。
    const res = await zoneApi.handle(
      new Request("http://localhost/zone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...createBody,
          boundary: { ...zoneBoundaryStub, template: "wiki-classic" },
        }),
      }),
    );

    expect(res.status).toBe(200);
    const input = createZoneMock.mock.calls[0]![0] as { boundary: object };
    expect("template" in input.boundary).toBe(false);

    // A structurally invalid envelope (wrong version literal) still 422s.
    // 结构无效的信封（错误的版本字面量）仍返回 422。
    createZoneMock.mockClear();
    const invalid = await zoneApi.handle(
      new Request("http://localhost/zone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...createBody,
          boundary: { ...zoneBoundaryStub, version: 99 },
        }),
      }),
    );
    expect(invalid.status).toBe(422);
    expect(createZoneMock).not.toHaveBeenCalled();
  });

  test("updates only after the current owner realm policy allows it", async () => {
    const { zoneApi } = await import("./zone.api");
    const denied = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          translations: [{ language: "en", title: "Renamed" }],
        }),
      }),
    );

    expect(denied.status).toBe(403);
    expect(updateZoneMock).not.toHaveBeenCalled();

    policyAllowed = true;
    decideForIdentityMock.mockClear();
    const allowed = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          translations: [{ language: "en", title: "Renamed" }],
        }),
      }),
    );

    expect(allowed.status).toBe(200);
    expect(updateZoneMock).toHaveBeenCalledWith(
      "zone-1",
      expect.objectContaining({
        translations: [{ language: "en", title: "Renamed" }],
      }),
    );
  });

  test("requires policy for both current and next owner realms on transfer", async () => {
    policyAllowed = true;

    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownerRealmUnitId: "realm-2" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(
      (decideForIdentityMock.mock.calls as unknown[][]).map((call) => call[0]),
    ).toEqual([
      {
        identity: currentIdentity,
        action: "zone.manage",
        target: { kind: "zone", id: "zone-1", realmUnitId: "realm-1" },
      },
      {
        identity: currentIdentity,
        action: "zone.manage",
        target: { kind: "zone", id: "zone-1", realmUnitId: "realm-2" },
      },
    ]);
  });

  test("deletes through the owner realm policy", async () => {
    policyAllowed = true;

    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1", { method: "DELETE" }),
    );
    expect(res.status).toBe(200);
    expect(deleteZoneMock).toHaveBeenCalled();
  });
});
