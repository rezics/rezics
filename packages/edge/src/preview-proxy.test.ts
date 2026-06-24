import { describe, expect, mock, test } from "bun:test";
import { proxyPreviewRequest } from "./preview-proxy";

describe("edge preview proxy", () => {
  test("forwards requests to preview with internal secret", async () => {
    const fetchImpl = mock(
      async (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ) => new Response("<html></html>"),
    );

    const response = await proxyPreviewRequest(
      new Request("https://rezics.com/book/book-1?lang=en"),
      {
        PREVIEW_BASE_URL: "https://preview.internal",
        PREVIEW_INTERNAL_SECRET: "secret",
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(response.status).toBe(200);
    expect(fetchImpl.mock.calls[0]?.[0]?.toString()).toBe(
      "https://preview.internal/book/book-1?lang=en",
    );
    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("x-internal-secret")).toBe("secret");
  });

  test("returns deterministic 503 when preview is unavailable", async () => {
    const response = await proxyPreviewRequest(
      new Request("https://rezics.com/book/book-1"),
      { PREVIEW_BASE_URL: "https://preview.internal" },
      {
        fetchImpl: mock(
          async (
            _input: Parameters<typeof fetch>[0],
            _init?: Parameters<typeof fetch>[1],
          ) => {
            throw new Error("network");
          },
        ) as unknown as typeof fetch,
      },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("preserves base path for monolith-mounted preview routes", async () => {
    const fetchImpl = mock(
      async (
        _input: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1],
      ) => new Response("<html></html>"),
    );

    await proxyPreviewRequest(
      new Request("https://rezics.com/book/book-1?lang=en"),
      {
        PREVIEW_BASE_URL: "https://api.internal/__services/preview",
      },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );

    expect(fetchImpl.mock.calls[0]?.[0]?.toString()).toBe(
      "https://api.internal/__services/preview/book/book-1?lang=en",
    );
  });
});
