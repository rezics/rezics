import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.AUTH_BASE_URL ??= "http://localhost:3001";

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({
      identity: { unitId: "t", permission: { role: "ADMIN" } },
    }),
  }),
  isAdminRole: () => true,
}));

const zoneStub = {
  unitId: "zone-1",
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
  zoneService: {
    getBySlug: async (slug: string) => {
      if (slug === "featured") return zoneStub;
      return null;
    },
    checkLifecycle: () => null,
  },
}));

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
