import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { entityAttributionApi } from "./entity-attribution.api";
import { entityAttributionKeys } from "./entity-attribution.keys";
import { invalidateEntityAttributionBatchQueries } from "./entity-attribution.mutations";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("entityAttributionApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          unitId: "book-1",
          changed: true,
          credits: [],
          subjects: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("sends a unit-scoped batch PATCH request", async () => {
    await entityAttributionApi.batchUpdate("book-1", {
      ops: [
        {
          op: "setCredits",
          role: "author",
          entries: [{ entityId: "entity-1", sortOrder: 0 }],
        },
      ],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/unit/book-1/entity-attributions/batch",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({
        ops: [
          {
            op: "setCredits",
            role: "author",
            entries: [{ entityId: "entity-1", sortOrder: 0 }],
          },
        ],
      }),
    });
  });

  test("exposes stable editor query keys", () => {
    expect(entityAttributionKeys.editor("book-1")).toEqual([
      "entity-attribution",
      "editor",
      "book-1",
    ]);
  });

  test("invalidates credit subject and shared editor queries", () => {
    const queryClient = {
      invalidateQueries: mock(async () => undefined),
    };

    invalidateEntityAttributionBatchQueries(queryClient, "book-1");

    expect(
      (queryClient.invalidateQueries.mock.calls as any[]).map(
        (call) => call[0],
      ),
    ).toEqual([
      { queryKey: ["credit-attribution", "by-unit", "book-1"] },
      {
        queryKey: ["subject-attribution", "by-unit", "book-1", undefined],
      },
      {
        queryKey: ["entity-attribution", "editor", "book-1"],
      },
      { queryKey: ["books", "detail", "book-1"] },
    ]);
  });
});
