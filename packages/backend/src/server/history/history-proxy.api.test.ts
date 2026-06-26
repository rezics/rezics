import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  HistoryProxyReader,
  HistoryProxyRepository,
} from "./history-proxy.api";

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
  async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    const body = url.includes("/structure-events")
      ? { events: [], nextCursor: null }
      : { revisions: [], nextCursor: null };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
);

const listUnitRevisions = mock(
  async (
    _input: Parameters<HistoryProxyReader["listUnitRevisions"]>[0],
  ) => ({
    revisions: [],
    nextCursor: null,
  }),
);

const compareRevisionPaths = mock(
  async (input: Parameters<HistoryProxyReader["compareRevisionPaths"]>[0]) => ({
    unitId: input.unitId,
    baseSequence: input.baseSequence,
    targetSequence: input.targetSequence,
    candidatePaths: [],
    changes: [],
  }),
);

function repository(): HistoryProxyRepository {
  return { findUnit };
}

function historyReader(): HistoryProxyReader {
  return { compareRevisionPaths, listUnitRevisions };
}

describe("historyProxyApi", () => {
  beforeEach(() => {
    findUnit.mockClear();
    fetchMock.mockClear();
    listUnitRevisions.mockClear();
    compareRevisionPaths.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("allows public Unit history through the in-process reader", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository(), historyReader());
    const response = await historyProxyApi.handle(
      new Request(
        "http://localhost/history/unit/unit-public/revisions?limit=10",
      ),
    );

    expect(response.status).toBe(200);
    expect(listUnitRevisions).toHaveBeenCalledWith({
      unitId: "unit-public",
      cursor: null,
      includeContent: false,
      limit: 10,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("blocks public raw revision content for non-owners before reading", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository(), historyReader());
    const response = await historyProxyApi.handle(
      new Request(
        "http://localhost/history/unit/unit-public/revisions?includeContent=true",
      ),
    );

    expect(response.status).toBe(403);
    expect(listUnitRevisions).not.toHaveBeenCalled();
    expect(compareRevisionPaths).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("allows raw revision content for the owner", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository(), historyReader());
    const response = await historyProxyApi.handle(
      new Request(
        "http://localhost/history/unit/unit-public/revisions?includeContent=true",
        {
          headers: { authorization: "Bearer owner" },
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(listUnitRevisions).toHaveBeenCalledWith({
      unitId: "unit-public",
      cursor: null,
      includeContent: true,
      limit: undefined,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("compares revisions through the in-process reader", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository(), historyReader());
    const response = await historyProxyApi.handle(
      new Request(
        "http://localhost/history/unit/unit-public/revisions/compare/1/3",
      ),
    );

    expect(response.status).toBe(200);
    expect(compareRevisionPaths).toHaveBeenCalledWith({
      unitId: "unit-public",
      baseSequence: 1,
      targetSequence: 3,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("continues to proxy structure event timelines over HTTP", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository(), historyReader());
    const response = await historyProxyApi.handle(
      new Request(
        "http://localhost/history/unit/unit-public/structure-events?limit=5",
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://history.example/history/unit/unit-public/structure-events?limit=5",
    );
    expect(listUnitRevisions).not.toHaveBeenCalled();
    expect(compareRevisionPaths).not.toHaveBeenCalled();
  });

  test("blocks structure event payloads for public non-owners", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository(), historyReader());
    const response = await historyProxyApi.handle(
      new Request(
        "http://localhost/history/unit/unit-public/structure-events?includePayload=true",
      ),
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("blocks private Unit history for non-owners before reading", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository(), historyReader());
    const response = await historyProxyApi.handle(
      new Request("http://localhost/history/unit/unit-private/revisions"),
    );

    expect(response.status).toBe(403);
    expect(listUnitRevisions).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("allows private Unit history for the owner", async () => {
    const { createHistoryProxyApi } = await import("./history-proxy.api");
    const historyProxyApi = createHistoryProxyApi(repository(), historyReader());
    const response = await historyProxyApi.handle(
      new Request("http://localhost/history/unit/unit-private/revisions", {
        headers: { authorization: "Bearer owner" },
      }),
    );

    expect(response.status).toBe(200);
    expect(listUnitRevisions).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
