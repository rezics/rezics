import { describe, expect, test } from "bun:test";
import { JOB_LANE_VALUES, JOB_LANES } from "@rezics/contract/job";
import { resolveWorkerLanes } from "./lanes";

describe("resolveWorkerLanes", () => {
  test("'all' subscribes to every lane", () => {
    expect(resolveWorkerLanes("all")).toEqual(JOB_LANE_VALUES);
  });

  test("'ranking' subscribes only to the ranking lane", () => {
    expect(resolveWorkerLanes("ranking")).toEqual([JOB_LANES.ranking]);
  });

  test("'default' subscribes to every lane except ranking", () => {
    const lanes = resolveWorkerLanes("default");
    expect(lanes).not.toContain(JOB_LANES.ranking);
    expect([...lanes, JOB_LANES.ranking].sort()).toEqual(
      [...JOB_LANE_VALUES].sort(),
    );
  });

  test("'default' and 'ranking' partition the full lane set", () => {
    const combined = [
      ...resolveWorkerLanes("default"),
      ...resolveWorkerLanes("ranking"),
    ].sort();
    expect(combined).toEqual([...JOB_LANE_VALUES].sort());
  });
});
