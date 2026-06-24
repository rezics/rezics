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

  test("creates a label through the label service endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          unitId: "label-1",
          translations: [{ language: "en", title: "Characters" }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const label = await labelApi.create({
      translations: [{ language: "en", title: "Characters" }],
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.example/label/");
    expect(label).toEqual({
      unitId: "label-1",
      translations: [{ language: "en", title: "Characters" }],
    });
  });
});
