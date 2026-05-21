import { describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const link = mock(async () => ({
  unitId: "work-1",
  entityId: "entity-1",
  role: "primary_character",
  sortOrder: 0,
}));

const unlink = mock(async () => {});
const listByUnit = mock(async () => []);
const listBySubject = mock(async () => []);

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

mock.module("./subject-attribution.service", () => ({
  subjectAttributionService: { link, unlink, listByUnit, listBySubject },
}));

async function makeApp() {
  const { subjectAttributionApi } = await import("./subject-attribution.api");
  return new Elysia().use(subjectAttributionApi);
}

describe("SubjectAttribution API validation", () => {
  test("rejects unregistered role before service writes", async () => {
    link.mockClear();
    const app = await makeApp();

    const res = await app.handle(
      new Request("http://localhost/subject-attribution", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          unitId: "work-1",
          entityId: "entity-1",
          role: "sect_founder",
        }),
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(link).not.toHaveBeenCalled();
  });
});
