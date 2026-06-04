import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { PollRepository } from "./poll.service";

const { PollService, PollError } = await import("./poll.service");
const { mapPollResultsToDTO, isPollClosed } = await import("./poll.mapper");

type PollTx = Parameters<Parameters<PollRepository["withTransaction"]>[0]>[0];

const HOUR = 1000 * 60 * 60;

function makePoll(overrides: Record<string, unknown> = {}) {
  return {
    unitId: "poll-1",
    voteMode: "SINGLE",
    resultVisibility: "LIVE",
    anonymous: false,
    closesAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 0,
    options: [],
    unit: { translations: [] },
    ...overrides,
  } as any;
}

function makeOption(optionId = "A") {
  return {
    pollUnitId: "poll-1",
    optionId,
    position: optionId.toLowerCase(),
    voteCount: 0,
    label: optionId,
    unitId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

function createHarness(
  input: {
    poll?: any;
    option?: any;
    vote?: any;
    votes?: { optionId: string; realmUnitId: string | null }[];
  } = {},
) {
  const poll = input.poll ?? makePoll();
  const tx: PollTx = {
    findPoll: mock(async () => poll),
    findPollRow: mock(async () => poll),
    updateVoteMode: mock(async () => {}),
    countVotes: mock(async () => 0),
    findOption: mock(async () => input.option ?? makeOption()),
    findVote: mock(async () => input.vote),
    findAnyVoteForUser: mock(async () => input.vote),
    createVote: mock(async () => {}),
    deleteVote: mock(async () => {}),
    incrementOptionVoteCount: mock(async () => {}),
  };

  const repository: PollRepository = {
    createPoll: mock(async (data) => makePoll({ unitId: "poll-1", data })),
    findPoll: mock(async () => poll),
    findVotesForUser: mock(async () => input.votes ?? []),
    withTransaction: mock(async (callback) => callback(tx)),
  };

  return { service: new PollService(repository), repository, tx };
}

describe("PollService.createPoll — option validation (5.3)", () => {
  test("rejects an option with neither label nor unitId", async () => {
    const { service } = createHarness();
    await expect(
      service.createPoll("user-1", {
        options: [{ label: "A" }, {}],
      } as any),
    ).rejects.toMatchObject({ code: "INVALID_OPTION" });
  });

  test("rejects an option with both label and unitId", async () => {
    const { service } = createHarness();
    await expect(
      service.createPoll("user-1", {
        options: [{ label: "A" }, { label: "B", unitId: "unit-x" }],
      } as any),
    ).rejects.toMatchObject({ code: "INVALID_OPTION" });
  });

  test("rejects fewer than two options", async () => {
    const { service } = createHarness();
    await expect(
      service.createPoll("user-1", { options: [{ label: "only" }] } as any),
    ).rejects.toBeInstanceOf(PollError);
  });

  test("creates poll + options when each option is valid (xor holds)", async () => {
    const { service, repository } = createHarness();

    await service.createPoll("user-1", {
      title: " Poll title ",
      options: [{ label: "A" }, { unitId: "unit-x" }],
    } as any);

    expect(repository.createPoll).toHaveBeenCalledTimes(1);
    const data = (repository.createPoll as any).mock.calls[0]?.[0] as any;
    expect(data).toMatchObject({
      userId: "user-1",
      title: "Poll title",
      voteMode: "SINGLE",
      resultVisibility: "LIVE",
      anonymous: false,
    });
    expect(data.options).toHaveLength(2);
    expect(data.options[0]).toMatchObject({ label: "A", unitId: null });
    expect(data.options[1]).toMatchObject({ label: null, unitId: "unit-x" });
  });
});

describe("PollService.castVote — single-choice (5.1)", () => {
  test("changing vote moves the row and adjusts both tallies", async () => {
    const { service, tx } = createHarness({
      poll: makePoll({ voteMode: "SINGLE" }),
      option: makeOption("B"),
      vote: { pollUnitId: "poll-1", userId: "user-1", optionId: "A" },
    });

    await service.castVote("user-1", "poll-1", "B");

    // Old vote row removed, new one created — exactly one remains.
    expect(tx.deleteVote).toHaveBeenCalledWith({
      pollUnitId: "poll-1",
      userId: "user-1",
      optionId: "A",
    });
    expect(tx.createVote).toHaveBeenCalledWith({
      pollUnitId: "poll-1",
      userId: "user-1",
      optionId: "B",
      voteMode: "SINGLE",
      realmUnitId: null,
    });

    // A decremented, B incremented.
    expect((tx.incrementOptionVoteCount as any).mock.calls).toEqual([
      ["poll-1", "A", -1],
      ["poll-1", "B", 1],
    ]);
  });

  test("records realm context on a new single-choice vote", async () => {
    const { service, tx } = createHarness({
      poll: makePoll({ voteMode: "SINGLE" }),
      option: makeOption("A"),
      vote: undefined,
    });

    await service.castVote("user-1", "poll-1", "A", "realm-1");

    expect(tx.createVote).toHaveBeenCalledWith({
      pollUnitId: "poll-1",
      userId: "user-1",
      optionId: "A",
      voteMode: "SINGLE",
      realmUnitId: "realm-1",
    });
  });

  test("re-casting the same option is a no-op (no duplicate row)", async () => {
    const { service, tx } = createHarness({
      poll: makePoll({ voteMode: "SINGLE" }),
      option: makeOption("A"),
      vote: { pollUnitId: "poll-1", userId: "user-1", optionId: "A" },
    });

    await service.castVote("user-1", "poll-1", "A");

    expect(tx.deleteVote).not.toHaveBeenCalled();
    expect(tx.createVote).not.toHaveBeenCalled();
    expect(tx.incrementOptionVoteCount).not.toHaveBeenCalled();
  });
});

describe("PollService.castVote — multi-choice (5.2)", () => {
  test("a user can hold several option votes; new rows are keyed per option", async () => {
    const { service, tx } = createHarness({
      poll: makePoll({ voteMode: "MULTI" }),
      option: makeOption("C"),
      vote: undefined,
    });

    await service.castVote("user-1", "poll-1", "C");

    expect(tx.createVote).toHaveBeenCalledWith({
      pollUnitId: "poll-1",
      userId: "user-1",
      optionId: "C",
      voteMode: "MULTI",
      realmUnitId: null,
    });
    expect(tx.incrementOptionVoteCount).toHaveBeenCalledWith("poll-1", "C", 1);
  });

  test("global option uniqueness checks ignore realm context for now", async () => {
    const { service, tx } = createHarness({
      poll: makePoll({ voteMode: "MULTI" }),
      option: makeOption("C"),
      vote: {
        pollUnitId: "poll-1",
        userId: "user-1",
        optionId: "C",
        realmUnitId: null,
      },
    });

    await service.castVote("user-1", "poll-1", "C", "realm-1");

    expect(tx.findVote).toHaveBeenCalledWith({
      pollUnitId: "poll-1",
      userId: "user-1",
      optionId: "C",
    });
    expect(tx.createVote).not.toHaveBeenCalled();
    expect(tx.incrementOptionVoteCount).not.toHaveBeenCalled();
  });
});

describe("PollService.withdrawVote (5.6)", () => {
  test("decrements voteCount and removes the vote row", async () => {
    const { service, tx } = createHarness({
      poll: makePoll({ voteMode: "SINGLE" }),
      vote: { pollUnitId: "poll-1", userId: "user-1", optionId: "A" },
    });

    await service.withdrawVote("user-1", "poll-1");

    expect(tx.deleteVote).toHaveBeenCalledWith({
      pollUnitId: "poll-1",
      userId: "user-1",
      optionId: "A",
    });
    expect(tx.incrementOptionVoteCount).toHaveBeenCalledWith("poll-1", "A", -1);
  });

  test("multi-choice withdraw requires an option id", async () => {
    const { service } = createHarness({
      poll: makePoll({ voteMode: "MULTI" }),
    });

    await expect(
      service.withdrawVote("user-1", "poll-1"),
    ).rejects.toMatchObject({ code: "WITHDRAW_OPTION_REQUIRED" });
  });

  test("withdraw uses the current global vote identity regardless of context", async () => {
    const { service, tx } = createHarness({
      poll: makePoll({ voteMode: "SINGLE" }),
      vote: {
        pollUnitId: "poll-1",
        userId: "user-1",
        optionId: "A",
        realmUnitId: "realm-1",
      },
    });

    await service.withdrawVote("user-1", "poll-1", undefined, "realm-2");

    expect(tx.deleteVote).toHaveBeenCalledWith({
      pollUnitId: "poll-1",
      userId: "user-1",
      optionId: "A",
    });
  });
});

describe("PollService — close behavior (5.4)", () => {
  test("voting is rejected after the poll is closed", async () => {
    const { service } = createHarness({
      poll: makePoll({
        voteMode: "SINGLE",
        closesAt: new Date(Date.now() - HOUR),
      }),
    });

    await expect(
      service.castVote("user-1", "poll-1", "A"),
    ).rejects.toMatchObject({ code: "POLL_CLOSED" });
  });

  test("AFTER_CLOSE results are hidden before close and revealed after", async () => {
    const openHarness = createHarness({
      poll: makePoll({
        resultVisibility: "AFTER_CLOSE",
        closesAt: new Date(Date.now() + HOUR),
      }),
    });
    const open = await openHarness.service.getResults("poll-1", {
      userId: "user-1",
    });
    expect(open.resultsVisible).toBe(false);

    const closedHarness = createHarness({
      poll: makePoll({
        resultVisibility: "AFTER_CLOSE",
        closesAt: new Date(Date.now() - HOUR),
      }),
    });
    const closed = await closedHarness.service.getResults("poll-1", {
      userId: "user-1",
    });
    expect(closed.resultsVisible).toBe(true);
  });

  test("AFTER_CLOSE results are visible to a privileged caller before close", async () => {
    const { service } = createHarness({
      poll: makePoll({
        resultVisibility: "AFTER_CLOSE",
        closesAt: new Date(Date.now() + HOUR),
      }),
    });
    const res = await service.getResults("poll-1", {
      userId: "owner",
      isPrivileged: true,
    });
    expect(res.resultsVisible).toBe(true);
  });
});

describe("poll.mapper — anonymity (5.5)", () => {
  const poll = {
    unitId: "poll-1",
    voteMode: "SINGLE" as const,
    resultVisibility: "LIVE" as const,
    anonymous: true,
    closesAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [
      {
        pollUnitId: "poll-1",
        optionId: "A",
        position: "a",
        voteCount: 3,
        label: "A",
        unitId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        pollUnitId: "poll-1",
        optionId: "B",
        position: "b",
        voteCount: 5,
        label: "B",
        unitId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  test("exposes aggregate tallies and the caller's own vote, never a voter mapping", () => {
    const dto = mapPollResultsToDTO(poll as any, {
      myVote: ["B"],
      myVoteContexts: [{ optionId: "B", realmUnitId: null }],
      resultsVisible: true,
    });

    expect(dto.anonymous).toBe(true);
    expect(dto.totalVotes).toBe(8);
    expect(dto.options.map((o) => o.voteCount)).toEqual([3, 5]);
    expect(dto.myVote).toEqual(["B"]);

    // No voter->option mapping is serialized anywhere in the DTO.
    expect(JSON.stringify(dto)).not.toContain("userId");
  });

  test("withholds option tallies and totalVotes when results are not visible", () => {
    const dto = mapPollResultsToDTO(poll as any, {
      myVote: ["B"],
      myVoteContexts: [{ optionId: "B", realmUnitId: null }],
      resultsVisible: false,
    });
    expect(dto.totalVotes).toBeUndefined();
    expect(dto.options.every((o) => o.voteCount === undefined)).toBe(true);
    // Caller's own vote is still returned even when tallies are withheld.
    expect(dto.myVote).toEqual(["B"]);
  });
});

describe("isPollClosed", () => {
  test("null closesAt is never closed", () => {
    expect(isPollClosed({ closesAt: null })).toBe(false);
  });
  test("past closesAt is closed", () => {
    expect(isPollClosed({ closesAt: new Date(Date.now() - HOUR) })).toBe(true);
  });
  test("future closesAt is open", () => {
    expect(isPollClosed({ closesAt: new Date(Date.now() + HOUR) })).toBe(false);
  });
});
