import type { PollOptionDTO, PollResultsDTO } from "@rezics/contract";
import { describe, expect, test } from "bun:test";
import { selectPollView } from "./pollView";

function option(overrides: Partial<PollOptionDTO> = {}): PollOptionDTO {
  return {
    pollUnitId: "poll-1",
    optionId: "opt-a",
    position: "a",
    label: "Option A",
    ...overrides,
  };
}

function results(overrides: Partial<PollResultsDTO> = {}): PollResultsDTO {
  return {
    pollUnitId: "poll-1",
    voteMode: "SINGLE",
    resultVisibility: "LIVE",
    anonymous: false,
    closed: false,
    resultsVisible: true,
    options: [
      option({ optionId: "opt-a", position: "a", voteCount: 3 }),
      option({
        optionId: "opt-b",
        position: "b",
        label: "Option B",
        voteCount: 1,
      }),
    ],
    totalVotes: 4,
    myVote: [],
    ...overrides,
  };
}

describe("selectPollView — vote mode", () => {
  test("carries SINGLE vote mode through", () => {
    expect(selectPollView(results({ voteMode: "SINGLE" })).voteMode).toBe(
      "SINGLE",
    );
  });

  test("carries MULTI vote mode through", () => {
    expect(selectPollView(results({ voteMode: "MULTI" })).voteMode).toBe(
      "MULTI",
    );
  });
});

describe("selectPollView — results visibility", () => {
  test("visible results expose counts, total, and bar percentages", () => {
    const view = selectPollView(results({ resultsVisible: true }));
    expect(view.countsVisible).toBe(true);
    expect(view.totalVotes).toBe(4);
    expect(view.options[0]?.voteCount).toBe(3);
    expect(view.options[0]?.percent).toBeCloseTo(75);
    expect(view.options[1]?.percent).toBeCloseTo(25);
  });

  test("withheld results hide counts, total, and bars", () => {
    const view = selectPollView(
      results({
        resultVisibility: "AFTER_CLOSE",
        resultsVisible: false,
        totalVotes: undefined,
        options: [
          option({ optionId: "opt-a", position: "a", voteCount: undefined }),
          option({ optionId: "opt-b", position: "b", voteCount: undefined }),
        ],
      }),
    );
    expect(view.countsVisible).toBe(false);
    expect(view.totalVotes).toBeUndefined();
    expect(view.options.every((o) => o.voteCount === undefined)).toBe(true);
    expect(view.options.every((o) => o.percent === 0)).toBe(true);
  });

  test("AFTER_CLOSE before close flags results-hidden-until-close while voting stays enabled", () => {
    const view = selectPollView(
      results({
        resultVisibility: "AFTER_CLOSE",
        resultsVisible: false,
        closed: false,
      }),
    );
    expect(view.resultsHiddenUntilClose).toBe(true);
    expect(view.votingEnabled).toBe(true);
  });

  test("LIVE poll never flags results-hidden-until-close", () => {
    const view = selectPollView(
      results({ resultVisibility: "LIVE", resultsVisible: true }),
    );
    expect(view.resultsHiddenUntilClose).toBe(false);
  });
});

describe("selectPollView — closed state", () => {
  test("open poll enables voting", () => {
    expect(selectPollView(results({ closed: false })).votingEnabled).toBe(true);
  });

  test("closed poll disables voting but keeps myVote highlighted", () => {
    const view = selectPollView(results({ closed: true, myVote: ["opt-a"] }));
    expect(view.votingEnabled).toBe(false);
    expect(view.closed).toBe(true);
    expect(view.options.find((o) => o.optionId === "opt-a")?.selected).toBe(
      true,
    );
  });
});

describe("selectPollView — anonymity", () => {
  test("anonymous poll only carries aggregates and the caller's own myVote", () => {
    const view = selectPollView(
      results({ anonymous: true, myVote: ["opt-b"] }),
    );
    expect(view.anonymous).toBe(true);
    // Only aggregate counts + the caller's selection are present; the view has
    // no field that could carry a voter↔option mapping.
    expect(view.options.find((o) => o.optionId === "opt-b")?.selected).toBe(
      true,
    );
    expect(view.options.find((o) => o.optionId === "opt-a")?.selected).toBe(
      false,
    );
    expect(Object.keys(view.options[0] ?? {})).not.toContain("voters");
  });
});

describe("selectPollView — selection from myVote", () => {
  test("marks every option in myVote as selected", () => {
    const view = selectPollView(
      results({ voteMode: "MULTI", myVote: ["opt-a", "opt-b"] }),
    );
    expect(view.options.every((o) => o.selected)).toBe(true);
  });
});

describe("selectPollView — option forms", () => {
  test("text option renders its label", () => {
    const view = selectPollView(
      results({
        options: [option({ optionId: "opt-a", position: "a", label: "Hello" })],
        totalVotes: 0,
      }),
    );
    expect(view.options[0]?.form).toBe("text");
    expect(view.options[0]?.label).toBe("Hello");
    expect(view.options[0]?.unitId).toBeNull();
  });

  test("unit-reference option carries unitId and no label", () => {
    const view = selectPollView(
      results({
        options: [
          option({
            optionId: "opt-a",
            position: "a",
            label: null,
            unitId: "unit-42",
          }),
        ],
        totalVotes: 0,
      }),
    );
    expect(view.options[0]?.form).toBe("unit");
    expect(view.options[0]?.unitId).toBe("unit-42");
    expect(view.options[0]?.label).toBeNull();
  });

  test("tombstoned option (both null) renders as tombstone but retains its count", () => {
    const view = selectPollView(
      results({
        resultsVisible: true,
        totalVotes: 5,
        options: [
          option({
            optionId: "opt-a",
            position: "a",
            label: null,
            unitId: null,
            voteCount: 2,
          }),
        ],
      }),
    );
    expect(view.options[0]?.form).toBe("tombstone");
    expect(view.options[0]?.label).toBeNull();
    expect(view.options[0]?.unitId).toBeNull();
    expect(view.options[0]?.voteCount).toBe(2);
  });
});

describe("selectPollView — ordering", () => {
  test("options are sorted by fractional position", () => {
    const view = selectPollView(
      results({
        totalVotes: 0,
        options: [
          option({ optionId: "opt-c", position: "c" }),
          option({ optionId: "opt-a", position: "a" }),
          option({ optionId: "opt-b", position: "b" }),
        ],
      }),
    );
    expect(view.options.map((o) => o.optionId)).toEqual([
      "opt-a",
      "opt-b",
      "opt-c",
    ]);
  });
});
