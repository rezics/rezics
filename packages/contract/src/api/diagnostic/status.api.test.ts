import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { statusApi } from "./status.api";
import { statusKeys } from "./status.keys";

const fetchMock = mock();

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("status API client", () => {
  beforeEach(() => {
    configureApi({
      apiBaseUrl: "http://api.example",
      authBaseUrl: "http://auth.example",
      reactionServiceUrl: "http://reaction.example",
    });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(ok({ status: "available" }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("calls only Rezics server status endpoints", async () => {
    await statusApi.getMeiliStatus();
    await statusApi.getSystemStatus();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/meili/status",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://api.example/diagnostic/system",
    );
  });

  test("uses stable status cache keys", () => {
    expect(statusKeys.meili()).toEqual(["status", "meili"]);
    expect(statusKeys.system()).toEqual(["status", "system"]);
  });
});
