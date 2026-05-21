import { describe, expect, test } from "bun:test";
import { parseFactoryArgs } from "./command";

describe("parseFactoryArgs", () => {
  test("parses Meili, scenario, and manifest flags", () => {
    const flags = parseFactoryArgs([
      "--preset=fast",
      "--no-interactive",
      "--meili=init-and-sync",
      "--scenario=large-post-tree,complex-shelf",
      "--scenario=large-history",
      "--manifest=both",
    ]);

    expect(flags.preset).toBe("fast");
    expect(flags.noInteractive).toBe(true);
    expect(flags.meiliMode).toBe("init-and-sync");
    expect(flags.scenarios).toEqual([
      "large-post-tree",
      "complex-shelf",
      "large-history",
    ]);
    expect(flags.manifestFormat).toBe("both");
  });

  test("parses all-scenarios and no-scenarios switches", () => {
    const flags = parseFactoryArgs(["--all-scenarios", "--no-scenarios"]);

    expect(flags.allScenarios).toBe(true);
    expect(flags.noScenarios).toBe(true);
  });
});
