import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

installPrismaClientMock();

const { PollService, PollError } = await import("./poll.service");
const { mapPollResultsToDTO, isPollClosed } = await import("./poll.mapper");

const service = new PollService();

/** Route every $transaction callback at the shared prismaMock as its tx. */
function useInlineTransaction() {
  prismaMock.$transaction = mock(async (fn: any) => fn(prismaMock));
}

const HOUR = 1000 * 60 * 60;

beforeEach(() => {
  for (const key of Object.keys(prismaMock)) delete prismaMock[key];
  useInlineTransaction();
});

describe("PollService.createPoll — option validation (5.3)", () => {
  test("rejects an option with neither label nor unitId", async () => {
    await expect(
      service.createPoll("user-1", {
        options: [{ label: "A" }, {}],
      } as any),
    ).rejects.toMatchObject({ code: "INVALID_OPTION" });
  });

  test("rejects an option with both label and unitId", async () => {
    await expect(
      service.createPoll("user-1", {
        options: [{ label: "A" }, { label: "B", unitId: "unit-x" }],
      } as any),
    ).rejects.toMatchObject({ code: "INVALID_OPTION" });
  });

  test("rejects fewer than two options", async () => {
    await expect(
      service.createPoll("user-1", { options: [{ label: "only" }] } as any),
    ).rejects.toBeInstanceOf(PollError);
  });

  test("creates poll + options when each option is valid (xor holds)", async () => {
    const createPoll = mock(async (_args?: any) => ({}));
    prismaMock.unit = { create: mock(async () => ({ id: "poll-1" })) };
    prismaMock.poll = {
      create: createPoll,
      findUniqueOrThrow: mock(async () => ({ unitId: "poll-1", options: [] })),
    };

    await service.createPoll("user-1", {
      options: [{ label: "A" }, { unitId: "unit-x" }],
    } as any);

    const data = createPoll.mock.calls[0]?.[0] as any;
    expect(data.data.options.create).toHaveLength(2);
    expect(data.data.options.create[0]).toMatchObject({
      label: "A",
      unitId: null,
    });
    expect(data.data.options.create[1]).toMatchObject({
      label: null,
      unitId: "unit-x",
    });
  });
});

describe("PollService.castVote — single-choice (5.1)", () => {
  test("changing vote moves the row and adjusts both tallies", async () => {
    const deleteVote = mock(async (_args?: any) => ({}));
    const createVote = mock(async (_args?: any) => ({}));
    const updateOption = mock(async (_args?: any) => ({}));

    prismaMock.poll = {
      findUnique: mock(async () => ({ voteMode: "SINGLE", closesAt: null })),
    };
    prismaMock.pollOption = {
      findUnique: mock(async () => ({ pollUnitId: "poll-1", optionId: "B" })),
      update: updateOption,
    };
    prismaMock.pollVote = {
      findFirst: mock(async () => ({
        pollUnitId: "poll-1",
        userId: "user-1",
        optionId: "A",
      })),
      delete: deleteVote,
      create: createVote,
    };

    await service.castVote("user-1", "poll-1", "B");

    // Old vote row removed, new one created — exactly one remains.
    expect(deleteVote).toHaveBeenCalledTimes(1);
    expect(createVote).toHaveBeenCalledTimes(1);
    expect((createVote.mock.calls[0]?.[0] as any).data).toMatchObject({
      optionId: "B",
      voteMode: "SINGLE",
    });

    // A decremented, B incremented.
    const updates = updateOption.mock.calls.map((c) => c[0] as any);
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: {
            pollUnitId_optionId: { pollUnitId: "poll-1", optionId: "A" },
          },
          data: { voteCount: { decrement: 1 } },
        }),
        expect.objectContaining({
          where: {
            pollUnitId_optionId: { pollUnitId: "poll-1", optionId: "B" },
          },
          data: { voteCount: { increment: 1 } },
        }),
      ]),
    );
  });

  test("re-casting the same option is a no-op (no duplicate row)", async () => {
    const deleteVote = mock(async (_args?: any) => ({}));
    const createVote = mock(async (_args?: any) => ({}));
    const updateOption = mock(async (_args?: any) => ({}));

    prismaMock.poll = {
      findUnique: mock(async () => ({ voteMode: "SINGLE", closesAt: null })),
    };
    prismaMock.pollOption = {
      findUnique: mock(async () => ({ pollUnitId: "poll-1", optionId: "A" })),
      update: updateOption,
    };
    prismaMock.pollVote = {
      findFirst: mock(async () => ({
        pollUnitId: "poll-1",
        userId: "user-1",
        optionId: "A",
      })),
      delete: deleteVote,
      create: createVote,
    };

    await service.castVote("user-1", "poll-1", "A");

    expect(deleteVote).not.toHaveBeenCalled();
    expect(createVote).not.toHaveBeenCalled();
    expect(updateOption).not.toHaveBeenCalled();
  });
});

describe("PollService.castVote — multi-choice (5.2)", () => {
  test("a user can hold several option votes; new rows are keyed per option", async () => {
    const createVote = mock(async (_args?: any) => ({}));
    const updateOption = mock(async (_args?: any) => ({}));

    prismaMock.poll = {
      findUnique: mock(async () => ({ voteMode: "MULTI", closesAt: null })),
    };
    prismaMock.pollOption = {
      findUnique: mock(async () => ({ pollUnitId: "poll-1", optionId: "C" })),
      update: updateOption,
    };
    prismaMock.pollVote = {
      findUnique: mock(async () => null), // no existing vote for this option
      create: createVote,
    };

    await service.castVote("user-1", "poll-1", "C");

    expect((createVote.mock.calls[0]?.[0] as any).data).toMatchObject({
      pollUnitId: "poll-1",
      userId: "user-1",
      optionId: "C",
      voteMode: "MULTI",
    });
    expect(updateOption).toHaveBeenCalledWith({
      where: { pollUnitId_optionId: { pollUnitId: "poll-1", optionId: "C" } },
      data: { voteCount: { increment: 1 } },
    });
  });
});

describe("PollService.withdrawVote (5.6)", () => {
  test("decrements voteCount and removes the vote row", async () => {
    const deleteVote = mock(async (_args?: any) => ({}));
    const updateOption = mock(async (_args?: any) => ({}));

    prismaMock.poll = {
      findUnique: mock(async () => ({ voteMode: "SINGLE", closesAt: null })),
    };
    prismaMock.pollVote = {
      findFirst: mock(async () => ({
        pollUnitId: "poll-1",
        userId: "user-1",
        optionId: "A",
      })),
      delete: deleteVote,
    };
    prismaMock.pollOption = { update: updateOption };

    await service.withdrawVote("user-1", "poll-1");

    expect(deleteVote).toHaveBeenCalledTimes(1);
    expect(updateOption).toHaveBeenCalledWith({
      where: { pollUnitId_optionId: { pollUnitId: "poll-1", optionId: "A" } },
      data: { voteCount: { decrement: 1 } },
    });
  });

  test("multi-choice withdraw requires an option id", async () => {
    prismaMock.poll = {
      findUnique: mock(async () => ({ voteMode: "MULTI", closesAt: null })),
    };
    await expect(
      service.withdrawVote("user-1", "poll-1"),
    ).rejects.toMatchObject({ code: "WITHDRAW_OPTION_REQUIRED" });
  });
});

describe("PollService — close behavior (5.4)", () => {
  test("voting is rejected after the poll is closed", async () => {
    prismaMock.poll = {
      findUnique: mock(async () => ({
        voteMode: "SINGLE",
        closesAt: new Date(Date.now() - HOUR),
      })),
    };
    await expect(
      service.castVote("user-1", "poll-1", "A"),
    ).rejects.toMatchObject({ code: "POLL_CLOSED" });
  });

  test("AFTER_CLOSE results are hidden before close and revealed after", async () => {
    prismaMock.pollVote = { findMany: mock(async () => []) };

    // Still open → withheld.
    prismaMock.poll = {
      findUnique: mock(async () => ({
        unitId: "poll-1",
        voteMode: "SINGLE",
        resultVisibility: "AFTER_CLOSE",
        anonymous: false,
        closesAt: new Date(Date.now() + HOUR),
        options: [],
      })),
    };
    const open = await service.getResults("poll-1", { userId: "user-1" });
    expect(open.resultsVisible).toBe(false);

    // Closed → revealed.
    prismaMock.poll = {
      findUnique: mock(async () => ({
        unitId: "poll-1",
        voteMode: "SINGLE",
        resultVisibility: "AFTER_CLOSE",
        anonymous: false,
        closesAt: new Date(Date.now() - HOUR),
        options: [],
      })),
    };
    const closed = await service.getResults("poll-1", { userId: "user-1" });
    expect(closed.resultsVisible).toBe(true);
  });

  test("AFTER_CLOSE results are visible to a privileged caller before close", async () => {
    prismaMock.pollVote = { findMany: mock(async () => []) };
    prismaMock.poll = {
      findUnique: mock(async () => ({
        unitId: "poll-1",
        voteMode: "SINGLE",
        resultVisibility: "AFTER_CLOSE",
        anonymous: false,
        closesAt: new Date(Date.now() + HOUR),
        options: [],
      })),
    };
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
      resultsVisible: true,
    });

    expect(dto.anonymous).toBe(true);
    expect(dto.totalVotes).toBe(8);
    expect(dto.options.map((o) => o.voteCount)).toEqual([3, 5]);
    expect(dto.myVote).toEqual(["B"]);

    // No voter↔option mapping is serialized anywhere in the DTO.
    expect(JSON.stringify(dto)).not.toContain("userId");
  });

  test("withholds option tallies and totalVotes when results are not visible", () => {
    const dto = mapPollResultsToDTO(poll as any, {
      myVote: ["B"],
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
