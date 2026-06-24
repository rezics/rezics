import { beforeEach, describe, expect, mock, test } from "bun:test";
import { configureApi } from "../config";
import { gameSystemRequirementApi } from "./game-system-requirement.api";
import { gameSystemRequirementKeys } from "./game-system-requirement.keys";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

describe("gameSystemRequirementApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ requirements: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("builds list requests with game and platform filters", async () => {
    await gameSystemRequirementApi.list({
      gameUnitId: "game-1",
      platformEntityId: "platform-steam",
      tier: "recommended",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/game-system-requirement?gameUnitId=game-1&platformEntityId=platform-steam&tier=recommended",
    );
  });

  test("builds stable list, game, and detail keys", () => {
    expect(gameSystemRequirementKeys.list({ gameUnitId: "game-1" })).toEqual([
      "game-system-requirement",
      "list",
      { gameUnitId: "game-1" },
    ]);
    expect(
      gameSystemRequirementKeys.byGame("game-1", { tier: "minimum" }),
    ).toEqual([
      "game-system-requirement",
      "list",
      "game",
      "game-1",
      { tier: "minimum" },
    ]);
    expect(gameSystemRequirementKeys.detail("req-1")).toEqual([
      "game-system-requirement",
      "detail",
      "req-1",
    ]);
  });
});
