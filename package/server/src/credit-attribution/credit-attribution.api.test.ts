import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const link = mock(async () => ({
  unitId: "book-1",
  entityId: "entity-1",
  role: "author",
  sortOrder: 0,
}));

const unlink = mock(async () => {});
const listByUnit = mock(async () => []);

mock.module("@/middleware", () => ({
  authMacro: new Elysia({ name: "macro/auth" }).macro("requireLogin", {
    resolve: () => ({
      identity: {
        sub: "user-1",
        userId: "user-1",
        permission: { role: "USER" },
      },
    }),
  }),
}));

mock.module("./credit-attribution.service", () => ({
  creditAttributionService: { link, unlink, listByUnit },
}));

async function makeApp() {
  const { creditAttributionApi } = await import("./credit-attribution.api");
  return new Elysia().use(creditAttributionApi);
}

describe("CreditAttribution API validation", () => {
  test("rejects unregistered role before service writes", async () => {
    link.mockClear();
    const app = await makeApp();

    const res = await app.handle(
      new Request("http://localhost/credit-attribution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unitId: "book-1",
          entityId: "entity-1",
          role: "color_assistant",
        }),
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(link).not.toHaveBeenCalled();
  });
});
