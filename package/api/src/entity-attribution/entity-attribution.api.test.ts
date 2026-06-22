import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { entityAttributionApi } from "./entity-attribution.api";
import { entityAttributionKeys } from "./entity-attribution.keys";

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
          entries: [{ entityId: "entity-1", position: "a" }],
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
            entries: [{ entityId: "entity-1", position: "a" }],
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
});
