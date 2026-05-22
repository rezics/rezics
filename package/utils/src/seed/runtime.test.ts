import { describe, expect, test } from "bun:test";
import { UnitType } from "@rezics/server/prisma/generated/client";
import { createSeedRuntime } from "./runtime";

describe("createSeedRuntime", () => {
  test("stores special targets separately from sync state", async () => {
    const runtime = createSeedRuntime({
      config: {
        meiliMode: "skip",
        manifestFormat: "human",
        scenarioNames: [],
      },
      authPrisma: { $disconnect: async () => {} } as never,
      serverPrisma: { $disconnect: async () => {} } as never,
    });

    await runtime.sync.entity("entity-1");
    runtime.addSpecialTarget({
      label: "Complex shelf",
      scenario: "complex-shelf",
      unitType: UnitType.SHELF,
      unitId: "shelf-1",
    });

    expect(runtime.state.syncSummary.total).toBe(0);
    expect(runtime.state.specialTargets).toEqual([
      {
        label: "Complex shelf",
        scenario: "complex-shelf",
        unitType: UnitType.SHELF,
        unitId: "shelf-1",
      },
    ]);
  });

  test("requires a search client when Meili sync is enabled", () => {
    expect(() =>
      createSeedRuntime({
        config: {
          meiliMode: "init-and-sync",
          manifestFormat: "human",
          scenarioNames: [],
        },
        authPrisma: { $disconnect: async () => {} } as never,
        serverPrisma: { $disconnect: async () => {} } as never,
      }),
    ).toThrow(/SearchClient/);
  });
});
