import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { unitExternalLinkApi } from "./unit-external-link.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("unitExternalLinkApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "link-1",
          unitId: "unit-1",
          sourceEntityUnitId: "source-entity-1",
          url: "https://book.qidian.com/info/123",
          role: "source",
          label: "Qidian",
          sourceEntity: {
            unitId: "source-entity-1",
            name: "Qidian",
            verified: true,
          },
          sortOrder: 0,
          createdAt: "2026-06-12T00:00:00.000Z",
          updatedAt: "2026-06-12T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("creates links from selected source Entity plus full URL", async () => {
    await unitExternalLinkApi.create({
      unitId: "unit-1",
      sourceEntityUnitId: "source-entity-1",
      url: "https://book.qidian.com/info/123",
      role: "source",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/unit-external-link",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        unitId: "unit-1",
        sourceEntityUnitId: "source-entity-1",
        url: "https://book.qidian.com/info/123",
        role: "source",
      }),
    });
  });

  test("filters unit links by source Entity without URL recognition", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ unitId: "unit-1", links: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await unitExternalLinkApi.links("unit-1", "source-entity-1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/unit-external-link/unit/unit-1/links?sourceEntityUnitId=source-entity-1",
    );
  });
});
