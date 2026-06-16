import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { creditAttributionApi } from "./credit-attribution.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("creditAttributionApi evidence", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          unitId: "book-1",
          entityId: "publisher-1",
          role: "publisher",
          position: "a",
          evidence: [
            {
              id: "evidence-1",
              unitId: "book-1",
              entityId: "publisher-1",
              role: "publisher",
              sourceExternalLinkId: "link-1",
              url: "https://book.qidian.com/info/123",
              observedAt: "2026-05-25T00:00:00.000Z",
              sourceExternalLink: {
                id: "link-1",
                unitId: "book-1",
                sourceEntityUnitId: "qidian-entity",
                url: "https://book.qidian.com/info/123",
                role: "source",
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("sends create evidence requests and preserves evidence-bearing DTOs", async () => {
    const dto = await creditAttributionApi.createEvidence({
      unitId: "book-1",
      entityId: "publisher-1",
      role: "publisher",
      sourceExternalLinkId: "link-1",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/credit-attribution/evidence",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        unitId: "book-1",
        entityId: "publisher-1",
        role: "publisher",
        sourceExternalLinkId: "link-1",
      }),
    });
    expect(dto.evidence?.[0]).toMatchObject({
      sourceExternalLinkId: "link-1",
      sourceExternalLink: { sourceEntityUnitId: "qidian-entity" },
    });
  });
});
