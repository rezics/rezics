import { describe, expect, test } from "bun:test";
import { FACTORY_SCENARIO_NAMES, FACTORY_SCENARIOS } from "./scenarios";

describe("factory scenarios", () => {
  test("registry exposes every scenario with defaults and runners", () => {
    expect(FACTORY_SCENARIO_NAMES).toEqual([
      "large-post-tree",
      "large-content-tree",
      "large-history",
      "complex-shelf",
    ]);

    for (const name of FACTORY_SCENARIO_NAMES) {
      expect(FACTORY_SCENARIOS[name].defaultSelected).toBe(true);
      expect(typeof FACTORY_SCENARIOS[name].run).toBe("function");
      expect(FACTORY_SCENARIOS[name].description.length).toBeGreaterThan(0);
    }
  });
});
