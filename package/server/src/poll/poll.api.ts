import type { PollDTO, PollResultsDTO } from "@rezics/contract";
import {
  castPollVoteSchema,
  createPollSchema,
  pollPathParamsSchema,
  withdrawPollVoteSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import { mapPollResultsToDTO, mapPollToDTO } from "./poll.mapper";
import { PollError, pollService } from "./poll.service";

function handlePollError(error: unknown): never {
  if (error instanceof PollError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

/**
 * Resolve poll results for a caller, applying owner/admin privilege so
 * AFTER_CLOSE tallies are visible to the poll owner before close.
 */
async function readResults(
  pollUnitId: string,
  identity: { userId: string; roles?: unknown } | null,
): Promise<PollResultsDTO> {
  const poll = await pollService.getPoll(pollUnitId);
  const ownerUserId = await (async () => {
    const { prisma } = await import("#/prisma/client");
    const unit = await prisma.unit.findUnique({
      where: { id: pollUnitId },
      select: { userId: true },
    });
    return unit?.userId ?? null;
  })();
  const isPrivileged =
    !!identity &&
    (isAdminRole(identity as any) || identity.userId === ownerUserId);

  const { myVote, resultsVisible } = await pollService.getResults(pollUnitId, {
    userId: identity?.userId,
    isPrivileged,
  });
  return mapPollResultsToDTO(poll, { myVote, resultsVisible });
}

export const pollApi = new Elysia({ prefix: "/poll" })
  .use(authMacro)

  // POST /poll — create a poll with options (login)
  .post(
    "/",
    async ({ body, identity }): Promise<PollDTO> => {
      try {
        const poll = await pollService.createPoll(identity.userId, body);
        return mapPollToDTO(poll);
      } catch (error) {
        handlePollError(error);
      }
    },
    {
      requireLogin: true,
      body: createPollSchema,
      detail: {
        summary: "Create a poll",
        description:
          "Creates a Unit(type=POLL) with ≥2 options. Each option sets exactly one of label or unitId.",
        tags: ["Polls"],
      },
    },
  )

  // GET /poll/:pollUnitId — read poll, options, and gated tallies
  .get(
    "/:pollUnitId",
    async ({ params, headers }): Promise<PollResultsDTO> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      try {
        return await readResults(params.pollUnitId, identity);
      } catch (error) {
        handlePollError(error);
      }
    },
    {
      params: pollPathParamsSchema,
      detail: {
        summary: "Read a poll and its results",
        description:
          "Returns options plus tallies, gated by resultVisibility and anonymity. The caller's own vote is always included.",
        tags: ["Polls"],
      },
    },
  )

  // POST /poll/:pollUnitId/vote — cast or change a vote (login)
  .post(
    "/:pollUnitId/vote",
    async ({ params, body, identity }): Promise<PollResultsDTO> => {
      try {
        await pollService.castVote(
          identity.userId,
          params.pollUnitId,
          body.optionId,
        );
        return await readResults(params.pollUnitId, identity);
      } catch (error) {
        handlePollError(error);
      }
    },
    {
      requireLogin: true,
      params: pollPathParamsSchema,
      body: castPollVoteSchema,
      detail: {
        summary: "Cast or change a poll vote",
        tags: ["Polls"],
      },
    },
  )

  // DELETE /poll/:pollUnitId/vote — withdraw a vote (login)
  .delete(
    "/:pollUnitId/vote",
    async ({ params, query, identity }): Promise<PollResultsDTO> => {
      try {
        await pollService.withdrawVote(
          identity.userId,
          params.pollUnitId,
          query.optionId,
        );
        return await readResults(params.pollUnitId, identity);
      } catch (error) {
        handlePollError(error);
      }
    },
    {
      requireLogin: true,
      params: pollPathParamsSchema,
      query: withdrawPollVoteSchema,
      detail: {
        summary: "Withdraw a poll vote",
        description:
          "Removes the caller's vote. For multi-choice polls, optionId selects which vote to drop.",
        tags: ["Polls"],
      },
    },
  );
