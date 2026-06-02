import type { CreatePollInput } from "@rezics/contract";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { keyAfter } from "@/book/position-index";
import { isPollClosed } from "./poll.mapper";
import type { PollWithOptions } from "./poll.types";
import { pollInclude } from "./poll.types";

export class PollError extends Error {
  constructor(
    public code:
      | "POLL_NOT_FOUND"
      | "OPTION_NOT_FOUND"
      | "INVALID_OPTION"
      | "TOO_FEW_OPTIONS"
      | "POLL_CLOSED"
      | "VOTE_MODE_LOCKED"
      | "WITHDRAW_OPTION_REQUIRED",
    message: string,
    public httpStatus: 400 | 403 | 404 | 409,
  ) {
    super(message);
    this.name = "PollError";
  }
}

/** Reject an option whose `label`/`unitId` are not in exactly-one (xor) form. */
function assertOptionXor(option: { label?: string; unitId?: string }): void {
  const hasLabel = option.label != null && option.label.trim().length > 0;
  const hasUnit = option.unitId != null && option.unitId.length > 0;
  if (hasLabel === hasUnit) {
    throw new PollError(
      "INVALID_OPTION",
      "Each poll option must set exactly one of `label` or `unitId`.",
      400,
    );
  }
}

function parseClosesAt(value: CreatePollInput["closesAt"]): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

export class PollService {
  /**
   * Create a poll: a `Unit(type=POLL)` plus its `Poll` extension and ≥2
   * `PollOption` rows. Validates the label-xor-unitId invariant per option and
   * assigns fractional positions in request order when not supplied.
   */
  async createPoll(
    userId: string,
    input: CreatePollInput,
  ): Promise<PollWithOptions> {
    if (!input.options || input.options.length < 2) {
      throw new PollError(
        "TOO_FEW_OPTIONS",
        "A poll must have at least two options.",
        400,
      );
    }
    for (const option of input.options) assertOptionXor(option);

    const voteMode = input.voteMode ?? "SINGLE";
    const closesAt = parseClosesAt(input.closesAt);
    const language = input.language ?? DEFAULT_LANGUAGE;

    let lastPosition: string | null = null;
    const optionData = input.options.map((option) => {
      const position = option.position ?? keyAfter(lastPosition);
      lastPosition = position;
      return {
        position,
        label: option.label ?? null,
        unitId: option.unitId ?? null,
      };
    });

    return prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          userId,
          slugScope: userId,
          type: UnitType.POLL,
          status: UnitStatus.PUBLISHED,
          publishedAt: new Date(),
          defaultLanguage: language,
          supportLanguages: {
            create: { language, isPrimary: true },
          },
        },
      });

      await tx.unitTranslation.create({
        data: {
          unitId: unit.id,
          language,
          title: input.title.trim(),
          summary: input.description?.trim() || null,
        },
      });

      await tx.poll.create({
        data: {
          unitId: unit.id,
          voteMode,
          resultVisibility: input.resultVisibility ?? "LIVE",
          anonymous: input.anonymous ?? false,
          closesAt,
          options: {
            create: optionData,
          },
        },
      });

      return tx.poll.findUniqueOrThrow({
        where: { unitId: unit.id },
        include: pollInclude,
      });
    });
  }

  /** Fetch a poll with its options, or throw if it is not a poll. */
  async getPoll(pollUnitId: string): Promise<PollWithOptions> {
    const poll = await prisma.poll.findUnique({
      where: { unitId: pollUnitId },
      include: pollInclude,
    });
    if (!poll) {
      throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
    }
    return poll;
  }

  /**
   * Change a poll's vote mode. Rejected once any vote exists, because the two
   * modes carry incompatible exclusivity constraints.
   */
  async changeVoteMode(
    pollUnitId: string,
    voteMode: "SINGLE" | "MULTI",
  ): Promise<PollWithOptions> {
    return prisma.$transaction(async (tx) => {
      const poll = await tx.poll.findUnique({ where: { unitId: pollUnitId } });
      if (!poll) {
        throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
      }
      if (poll.voteMode !== voteMode) {
        const voteCount = await tx.pollVote.count({ where: { pollUnitId } });
        if (voteCount > 0) {
          throw new PollError(
            "VOTE_MODE_LOCKED",
            "Cannot change vote mode after votes exist.",
            409,
          );
        }
        await tx.poll.update({
          where: { unitId: pollUnitId },
          data: { voteMode },
        });
      }
      return tx.poll.findUniqueOrThrow({
        where: { unitId: pollUnitId },
        include: pollInclude,
      });
    });
  }

  /**
   * Cast or change a vote, maintaining `PollOption.voteCount` on every change.
   *
   * - SINGLE: the user holds at most one vote; casting a different option moves
   *   it (old row removed, new row inserted) and adjusts both tallies. The
   *   partial unique index guarantees no duplicate row at the DB layer.
   * - MULTI: each (user, option) is an independent row; re-casting the same
   *   option is a no-op.
   */
  async castVote(
    userId: string,
    pollUnitId: string,
    optionId: string,
    realmUnitId?: string | null,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const poll = await tx.poll.findUnique({ where: { unitId: pollUnitId } });
      if (!poll) {
        throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
      }
      if (isPollClosed(poll)) {
        throw new PollError(
          "POLL_CLOSED",
          "This poll is closed and no longer accepts votes.",
          409,
        );
      }

      const option = await tx.pollOption.findUnique({
        where: { pollUnitId_optionId: { pollUnitId, optionId } },
      });
      if (!option) {
        throw new PollError(
          "OPTION_NOT_FOUND",
          "Option does not belong to this poll.",
          404,
        );
      }

      if (poll.voteMode === "SINGLE") {
        const existing = await tx.pollVote.findFirst({
          where: { pollUnitId, userId },
        });
        if (existing) {
          if (existing.optionId === optionId) return; // no-op
          await tx.pollVote.delete({
            where: {
              pollUnitId_userId_optionId: {
                pollUnitId,
                userId,
                optionId: existing.optionId,
              },
            },
          });
          await tx.pollOption.update({
            where: {
              pollUnitId_optionId: { pollUnitId, optionId: existing.optionId },
            },
            data: { voteCount: { decrement: 1 } },
          });
        }
        await tx.pollVote.create({
          data: {
            pollUnitId,
            userId,
            optionId,
            voteMode: "SINGLE",
            realmUnitId: realmUnitId ?? null,
          },
        });
        await tx.pollOption.update({
          where: { pollUnitId_optionId: { pollUnitId, optionId } },
          data: { voteCount: { increment: 1 } },
        });
        return;
      }

      // MULTI
      const existing = await tx.pollVote.findUnique({
        where: {
          pollUnitId_userId_optionId: { pollUnitId, userId, optionId },
        },
      });
      if (existing) return; // already voted for this option
      await tx.pollVote.create({
        data: {
          pollUnitId,
          userId,
          optionId,
          voteMode: "MULTI",
          realmUnitId: realmUnitId ?? null,
        },
      });
      await tx.pollOption.update({
        where: { pollUnitId_optionId: { pollUnitId, optionId } },
        data: { voteCount: { increment: 1 } },
      });
    });
  }

  /**
   * Withdraw a vote, decrementing the option tally and removing the row.
   * SINGLE polls ignore `optionId` (the user holds one vote); MULTI polls
   * require it.
   */
  async withdrawVote(
    userId: string,
    pollUnitId: string,
    optionId?: string,
    _realmUnitId?: string | null,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const poll = await tx.poll.findUnique({ where: { unitId: pollUnitId } });
      if (!poll) {
        throw new PollError("POLL_NOT_FOUND", "Poll not found.", 404);
      }
      if (isPollClosed(poll)) {
        throw new PollError(
          "POLL_CLOSED",
          "This poll is closed and no longer accepts vote changes.",
          409,
        );
      }

      if (poll.voteMode === "MULTI" && !optionId) {
        throw new PollError(
          "WITHDRAW_OPTION_REQUIRED",
          "An option is required to withdraw a vote from a multi-choice poll.",
          400,
        );
      }

      const target = optionId
        ? await tx.pollVote.findUnique({
            where: {
              pollUnitId_userId_optionId: { pollUnitId, userId, optionId },
            },
          })
        : await tx.pollVote.findFirst({ where: { pollUnitId, userId } });

      if (!target) return; // nothing to withdraw

      await tx.pollVote.delete({
        where: {
          pollUnitId_userId_optionId: {
            pollUnitId,
            userId,
            optionId: target.optionId,
          },
        },
      });
      await tx.pollOption.update({
        where: {
          pollUnitId_optionId: { pollUnitId, optionId: target.optionId },
        },
        data: { voteCount: { decrement: 1 } },
      });
    });
  }

  /**
   * Read poll results with result-visibility and anonymity gating.
   *
   * - `resultsVisible` is true for LIVE polls, and for AFTER_CLOSE polls only
   *   once closed or to a privileged caller (poll owner / admin).
   * - `myVote` is the calling user's own selection and is always returned,
   *   even for anonymous or pre-close polls. The voter↔option mapping for other
   *   users is never read here.
   */
  async getResults(
    pollUnitId: string,
    options?: { userId?: string; isPrivileged?: boolean },
  ): Promise<{
    poll: PollWithOptions;
    myVote: string[];
    myVoteContexts: { optionId: string; realmUnitId: string | null }[];
    resultsVisible: boolean;
  }> {
    const poll = await this.getPoll(pollUnitId);

    const closed = isPollClosed(poll);
    const resultsVisible =
      poll.resultVisibility === "LIVE" ||
      closed ||
      options?.isPrivileged === true;

    let myVote: string[] = [];
    let myVoteContexts: { optionId: string; realmUnitId: string | null }[] = [];
    if (options?.userId) {
      const votes = await prisma.pollVote.findMany({
        where: { pollUnitId, userId: options.userId },
        select: { optionId: true, realmUnitId: true },
      });
      myVote = votes.map((v) => v.optionId);
      myVoteContexts = votes.map((vote) => ({
        optionId: vote.optionId,
        realmUnitId: vote.realmUnitId ?? null,
      }));
    }

    return { poll, myVote, myVoteContexts, resultsVisible };
  }
}

export const pollService = new PollService();
