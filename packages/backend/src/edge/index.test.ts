import { describe, expect, mock, test } from "bun:test";
import { type EdgeEnv, handleRequest } from "./index";

function env(fetchImpl: typeof fetch): EdgeEnv {
  return {
    PREVIEW_BASE_URL: "https://preview.internal",
    ASSETS: {
      fetch: fetchImpl,
    },
  };
}

describe("edge handler", () => {
  test("sends human traffic to static assets", async () => {
    const assetFetch = mock(async () => new Response("asset"));

    const response = await handleRequest(
      new Request("https://rezics.com/book/book-1", {
        headers: { "user-agent": "Mozilla/5.0" },
      }),
      env(assetFetch as unknown as typeof fetch),
    );

    expect(await response.text()).toBe("asset");
    expect(assetFetch).toHaveBeenCalled();
  });

  test("sends bot traffic on eligible paths to preview", async () => {
    const assetFetch = mock(async () => new Response("asset"));
    const response = await handleRequest(
      new Request("https://rezics.com/book/book-1", {
        headers: { "user-agent": "Twitterbot" },
      }),
      { ...env(assetFetch as unknown as typeof fetch), PREVIEW_BASE_URL: "" },
    );

    expect(response.status).toBe(503);
    expect(assetFetch).not.toHaveBeenCalled();
  });
});
