import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { labelApi } from "./label.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("labelApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("unwraps label search response items", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              unitId: "label-1",
              translations: [{ language: "en", title: "Characters" }],
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const labels = await labelApi.search("char", 12);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/label/search?q=char&limit=12",
    );
    expect(labels).toEqual([
      {
        unitId: "label-1",
        translations: [{ language: "en", title: "Characters" }],
      },
    ]);
  });
});
