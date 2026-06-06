import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { HistoryProxyRepository } from "./history-proxy.api";

mock.module("../env", () => ({
  env: { HISTORY_BASE_URL: "http://history.example" },
}));

mock.module("../middleware", () => ({
  isAdminRole: (identity: any) => identity?.permission?.role === "ADMIN",
  tryResolveIdentity: async (authorization?: string) =>
    authorization === "Bearer owner"
      ? { userId: "owner-1", permission: { role: "USER" } }
      : null,
}));

const findUnit = mock(async (unitId: string) => {
  if (unitId === "unit-public") {
    return {
      id: "unit-public",
      userId: "owner-1",
      visibility: "PUBLIC" as const,
      status: "PUBLISHED" as const,
    };
  }
  if (unitId === "unit-private") {
    return {
      id: "unit-private",
      userId: "owner-1",
      visibility: "PRIVATE" as const,
      status: "PUBLISHED" as const,
    };
  }
  return undefined;
});

const fetchMock = mock(
  async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify({ revisions: [], nextCursor: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
);

function repository(): HistoryProxyRepository {
  return { findUnit };
}

describe("historyProxyApi", () => {
  beforeEach(() => {
    findUnit.mockClear();
    fetchMock.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("allows public Unit history through the app-facing proxy", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository());
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
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository());
    const response = await historyProxyApi.handle(
      new Request("http://localhost/history/unit/unit-private/revisions"),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("allows private Unit history for the owner", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository());
    const response = await historyProxyApi.handle(
      new Request("http://localhost/history/unit/unit-private/revisions", {
        headers: { authorization: "Bearer owner" },
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
