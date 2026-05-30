import { describe, expect, mock, test } from "bun:test";

const runFactoryCalls: unknown[] = [];

mock.module("./index", () => ({
  runFactory: mock(async (options: unknown) => {
    runFactoryCalls.push(options);
  }),
}));

describe("runFactoryCommand", () => {
  test("passes typed options through without reparsing argv", async () => {
    const { runFactoryCommand } = await import("./command");

    await runFactoryCommand({
      presetName: "fast",
      noInteractive: true,
      meiliMode: "init-and-sync",
      scenarioNames: ["large-post-tree", "complex-shelf", "large-history"],
      manifestFormat: "both",
      allScenarios: true,
      noScenarios: false,
    });

    expect(runFactoryCalls).toEqual([
      {
        presetName: "fast",
        noInteractive: true,
        meiliMode: "init-and-sync",
        scenarioNames: ["large-post-tree", "complex-shelf", "large-history"],
        manifestFormat: "both",
        allScenarios: true,
        noScenarios: false,
      },
    ]);
  });
});
