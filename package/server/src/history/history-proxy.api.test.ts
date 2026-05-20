import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

mock.module("@/env", () => ({
  env: { HISTORY_BASE_URL: "http://history.example" },
}));

mock.module("@/middleware", () => ({
  isAdminRole: (identity: any) => identity?.permission?.role === "ADMIN",
  tryResolveIdentity: async (authorization?: string) =>
    authorization === "Bearer owner"
      ? { userId: "owner-1", permission: { role: "USER" } }
      : null,
}));

const unitFindUnique = mock(async ({ where }: any) => {
  if (where.id === "unit-public") {
    return {
      id: "unit-public",
      userId: "owner-1",
      visibility: "PUBLIC",
      status: "PUBLISHED",
    };
  }
  if (where.id === "unit-private") {
    return {
      id: "unit-private",
      userId: "owner-1",
      visibility: "PRIVATE",
      status: "PUBLISHED",
    };
  }
  return null;
});

const fetchMock = mock(
  async () =>
    new Response(JSON.stringify({ revisions: [], nextCursor: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
);

installPrismaClientMock();
Object.assign(prismaMock, {
  unit: { findUnique: unitFindUnique },
});

describe("historyProxyApi", () => {
  beforeEach(() => {
    unitFindUnique.mockClear();
    fetchMock.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("allows public Unit history through the app-facing proxy", async () => {
    const { historyProxyApi } = await import("./history-proxy.api");
    const response = await historyProxyApi.handle(
      new Request(
        "http://localhost/history/unit/unit-public/revisions?limit=10&includeContent=true",
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://history.example/history/unit/unit-public/revisions?includeContent=true&limit=10",
    );
  });

  test("blocks private Unit history for non-owners before proxying", async () => {
    const { historyProxyApi } = await import("./history-proxy.api");
    const response = await historyProxyApi.handle(
      new Request("http://localhost/history/unit/unit-private/revisions"),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("allows private Unit history for the owner", async () => {
    const { historyProxyApi } = await import("./history-proxy.api");
    const response = await historyProxyApi.handle(
      new Request("http://localhost/history/unit/unit-private/revisions", {
        headers: { authorization: "Bearer owner" },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
