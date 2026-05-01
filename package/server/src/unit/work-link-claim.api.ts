import {
  type WorkLinkClaimListResponse,
  type WorkLinkClaimResponse,
  workLinkClaimActionPathParamsSchema,
  workLinkClaimListQuerySchema,
  workLinkClaimListResponseSchema,
  workLinkClaimRejectBodySchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro } from "@/middleware";
import {
  approve,
  listByWork,
  reject,
  withdraw,
  WorkLinkClaimError,
} from "./work-link-claim.service";

// Param name `unitId` matches `unitApi`'s — memoirist requires param names to agree at the same trie position.
const workListPathParamsSchema = t.Object({
  unitId: t.String(),
});

function handleError(error: unknown): never {
  if (error instanceof WorkLinkClaimError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

export const workLinkClaimApi = new Elysia()
  .use(authMacro)
  .get(
    "/unit/:unitId/work-link-claims",
    async ({
      params,
      query,
      identity,
    }): Promise<WorkLinkClaimListResponse> => {
      try {
        const claims = await listByWork(identity, params.unitId, query.status);
        return { claims };
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: workListPathParamsSchema,
      query: workLinkClaimListQuerySchema,
      response: workLinkClaimListResponseSchema,
      detail: {
        summary: "List work-link claims for a Work (inbox)",
        description:
          "Lists pending/all claims targeting a Work Unit (`:unitId` is the work's Unit ID). Caller must have authority over the work. Soft-deleted releases are filtered.",
        tags: ["Units", "WorkLink"],
      },
    },
  )
  .post(
    "/work-link-claims/:claimId/approve",
    async ({ params, identity }): Promise<WorkLinkClaimResponse> => {
      try {
        return await approve(identity, params.claimId);
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: workLinkClaimActionPathParamsSchema,
      detail: {
        summary: "Approve a work-link claim",
        description:
          "Sets `Unit.workUnitId` on the release and marks the claim APPROVED. Caller must have authority over the work.",
        tags: ["Units", "WorkLink"],
      },
    },
  )
  .post(
    "/work-link-claims/:claimId/reject",
    async ({ params, body, identity }): Promise<WorkLinkClaimResponse> => {
      try {
        return await reject(identity, params.claimId, body.reason);
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: workLinkClaimActionPathParamsSchema,
      body: workLinkClaimRejectBodySchema,
      detail: {
        summary: "Reject a work-link claim",
        description:
          "Marks the claim REJECTED with optional reason; release link is unchanged. Caller must have authority over the work.",
        tags: ["Units", "WorkLink"],
      },
    },
  )
  .delete(
    "/work-link-claims/:claimId",
    async ({ params, identity }): Promise<WorkLinkClaimResponse> => {
      try {
        return await withdraw(identity, params.claimId);
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: workLinkClaimActionPathParamsSchema,
      detail: {
        summary: "Withdraw a work-link claim",
        description:
          "Marks the claim WITHDRAWN. Only the original claimer may withdraw their pending claim.",
        tags: ["Units", "WorkLink"],
      },
    },
  );

export type WorkLinkClaimApi = typeof workLinkClaimApi;
