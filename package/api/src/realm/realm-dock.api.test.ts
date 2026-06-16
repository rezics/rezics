import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { RealmDock } from "@rezics/contract";
import { configureApi } from "../config";
import { realmDockApi } from "./realm-dock.api";

const fetchMock = mock();

configureApi({
  apiBaseUrl: "http://api.example",
  authBaseUrl: "http://auth.example",
  reactionServiceUrl: "http://reaction.example",
});

const dock: RealmDock = {
  schema: "rezics/realm-dock",
  version: 1,
  placements: {
    main: [
      { slot: "builtin", id: "description", maxLines: 4 },
      { slot: "builtin", id: "subscriptionStat" },
      { slot: "builtin", id: "realmFacts" },
      { slot: "builtin", id: "bookmarks", items: [] },
      { slot: "builtin", id: "rules", mode: "summary" },
      { slot: "builtin", id: "moderators", limit: 5 },
    ],
  },
};

describe("realmDockApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(dock), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test("reads the realm Dock endpoint", async () => {
    await realmDockApi.read("realm-1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/realm/realm-1/dock",
    );
  });

  test("updates the realm Dock endpoint without sidebar compatibility aliases", async () => {
    await realmDockApi.update("realm-1", dock);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://api.example/realm/realm-1/dock",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify(dock),
    });
  });
});
