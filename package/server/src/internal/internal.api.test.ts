import { describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";
process.env.SERVER_INTERNAL_SECRET = "test-secret";

const mockUpsert = mock(async () => ({
  unitId: "user-1",
  slug: "testuser",
  name: "Test User",
}));

const mockFindUnique = mock(async () => null);

mock.module("#/prisma/client", () => ({
  prisma: {
    user: { upsert: mockUpsert },
    unit: { findUnique: mockFindUnique },
  },
}));

mock.module("@/meili/user/sync", () => ({
  syncUserToMeili: mock(async () => {}),
}));

mock.module("../env", () => ({
  env: {
    SERVER_INTERNAL_SECRET: "test-secret",
  },
}));

describe("POST /internal/users/provision", () => {
  test("creates a new user on first provision", async () => {
    const { internalApi } = await import("./internal.api");

    const response = await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "x-internal-secret": "test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          unitId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(mockUpsert).toHaveBeenCalled();
  });

  test("duplicate provision is idempotent", async () => {
    mockUpsert.mockResolvedValueOnce({
      unitId: "user-1",
      slug: "testuser",
      name: "Test User",
    });

    const { internalApi } = await import("./internal.api");

    const response = await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "x-internal-secret": "test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          unitId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(response.status).toBe(200);
  });

  test("missing secret returns 401", async () => {
    const { internalApi } = await import("./internal.api");

    const response = await internalApi.handle(
      new Request("http://localhost/internal/users/provision", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          unitId: "user-1",
          slug: "testuser",
          name: "Test User",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
