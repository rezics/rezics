import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";

const fetchMock = mock();

describe("session refresh", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    configureApi({
      apiBaseUrl: "http://api.example",
      authBaseUrl: "http://api.example",
      reactionServiceUrl: "http://reaction.example",
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("exchangeForSessionToken posts to /auth/session/refresh with credentials", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { exchangeForSessionToken } = await import("./jwt");
    const ok = await exchangeForSessionToken();

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/auth/session/refresh",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
  });
});
