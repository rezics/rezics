import { beforeEach, describe, expect, mock, test } from "bun:test";
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
const deleteZoneMock = mock(async () => undefined);

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

const zoneStub = {
  unitId: "zone-1",
  ownerRealmUnitId: "realm-1",
  slug: "featured",
  unit: { visibility: "PUBLIC" },
  template: "grid",
  filters: {},
  styling: null,
};

mock.module("./zone.mapper", () => ({
  mapZoneToDTO: (z: unknown) => z,
}));

mock.module("./zone.service", () => ({
  ZoneService: class {
    checkLifecycle(zone: { startsAt?: Date | null; endsAt?: Date | null }) {
      const now = Date.now();
      if (zone.startsAt && zone.startsAt.getTime() > now) return "not_started";
      if (zone.endsAt && zone.endsAt.getTime() < now) return "ended";
      return null;
    }
  },
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
  deleteZoneMock.mockClear();
});

describe("GET /zone/by-slug/:slug", () => {
  test("returns zone when slug resolves to ZONE", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/by-slug/featured"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(zoneStub);
  });

  test("returns 404 when slug does not exist or resolves to non-zone", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/by-slug/does-not-exist"),
    );
    expect(res.status).toBe(404);
  });
});

describe("zone mutation policy", () => {
  test("denies zone creation rejected by the owner realm policy", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "new-zone",
          translations: [{ language: "en", title: "New Zone" }],
          ownerRealmUnitId: "realm-1",
          filters: {},
          template: "default",
        }),
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
        body: JSON.stringify({
          slug: "new-zone",
          translations: [{ language: "en", title: "New Zone" }],
          ownerRealmUnitId: "realm-1",
          filters: {},
          template: "default",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(createZoneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        ownerRealmUnitId: "realm-1",
      }),
    );
  });

  test("updates only after the current owner realm policy allows it", async () => {
    const { zoneApi } = await import("./zone.api");
    const denied = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template: "updated" }),
      }),
    );

    expect(denied.status).toBe(403);
    expect(updateZoneMock).not.toHaveBeenCalled();
    expect(decideForIdentityMock).toHaveBeenCalledWith({
      identity: currentIdentity,
      action: "zone.manage",
      target: {
        kind: "zone",
        id: "zone-1",
        realmUnitId: "realm-1",
      },
    });

    policyAllowed = true;
    decideForIdentityMock.mockClear();
    const allowed = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template: "updated" }),
      }),
    );

    expect(allowed.status).toBe(200);
    expect(updateZoneMock).toHaveBeenCalledWith(
      "zone-1",
      expect.objectContaining({ template: "updated" }),
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
    expect(decideForIdentityMock.mock.calls.map((call) => call[0])).toEqual([
      {
        identity: currentIdentity,
        action: "zone.manage",
        target: {
          kind: "zone",
          id: "zone-1",
          realmUnitId: "realm-1",
        },
      },
      {
        identity: currentIdentity,
        action: "zone.manage",
        target: {
          kind: "zone",
          id: "zone-1",
          realmUnitId: "realm-2",
        },
      },
    ]);
    expect(updateZoneMock).toHaveBeenCalled();
  });

  test("deletes only after the current owner realm policy allows it", async () => {
    const { zoneApi } = await import("./zone.api");
    const denied = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1", { method: "DELETE" }),
    );

    expect(denied.status).toBe(403);
    expect(deleteZoneMock).not.toHaveBeenCalled();

    policyAllowed = true;
    const allowed = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1", { method: "DELETE" }),
    );

    expect(allowed.status).toBe(200);
    expect(deleteZoneMock).toHaveBeenCalledWith("zone-1");
  });
});

describe("GET /zone/:unitId", () => {
  test("returns zone when id resolves to ZONE", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/zone-1"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(zoneStub);
  });

  test("does not resolve slug-shaped segments through the unitId route", async () => {
    const { zoneApi } = await import("./zone.api");
    const res = await zoneApi.handle(
      new Request("http://localhost/zone/featured"),
    );
    expect(res.status).toBe(404);
  });
});
