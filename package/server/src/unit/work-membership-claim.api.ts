import {
  type WorkMembershipClaimListResponse,
  type WorkMembershipClaimResponse,
  workMembershipClaimActionPathParamsSchema,
  workMembershipClaimListQuerySchema,
  workMembershipClaimListResponseSchema,
  workMembershipClaimRejectBodySchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro } from "@/middleware";
import {
  approve,
  listByWork,
  reject,
  WorkMembershipClaimError,
  withdraw,
} from "./work-membership-claim.service";

// Param name `unitId` matches `unitApi`'s — memoirist requires param names to agree at the same trie position.
const workListPathParamsSchema = t.Object({
  unitId: t.String(),
});

function handleError(error: unknown): never {
  if (error instanceof WorkMembershipClaimError) {
    throw status(error.httpStatus, {
      code: error.code,
      message: error.message,
    });
  }
  throw error;
}

export const workMembershipClaimApi = new Elysia()
  .use(authMacro)
  .get(
    "/unit/:unitId/work-membership-claims",
    async ({
      params,
      query,
      identity,
    }): Promise<WorkMembershipClaimListResponse> => {
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
      query: workMembershipClaimListQuerySchema,
      response: workMembershipClaimListResponseSchema,
      detail: {
        summary: "List work membership claims for a Work (inbox)",
        description:
          "Lists pending/all claims targeting a Work Unit (`:unitId` is the work's Unit ID). Caller must have authority over the work. Soft-deleted releases are filtered.",
        tags: ["Units", "UnitWork"],
      },
    },
  )
  .post(
    "/work-membership-claims/:claimId/approve",
    async ({ params, identity }): Promise<WorkMembershipClaimResponse> => {
      try {
        return await approve(identity, params.claimId);
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: workMembershipClaimActionPathParamsSchema,
      detail: {
        summary: "Approve a work membership claim",
        description:
          "Creates a `UnitWork(role = RELEASE)` membership and marks the claim APPROVED. Caller must have authority over the work.",
        tags: ["Units", "UnitWork"],
      },
    },
  )
  .post(
    "/work-membership-claims/:claimId/reject",
    async ({
      params,
      body,
      identity,
    }): Promise<WorkMembershipClaimResponse> => {
      try {
        return await reject(identity, params.claimId, body.reason);
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: workMembershipClaimActionPathParamsSchema,
      body: workMembershipClaimRejectBodySchema,
      detail: {
        summary: "Reject a work membership claim",
        description:
          "Marks the claim REJECTED with optional reason; release membership is unchanged. Caller must have authority over the work.",
        tags: ["Units", "UnitWork"],
      },
    },
  )
  .delete(
    "/work-membership-claims/:claimId",
    async ({ params, identity }): Promise<WorkMembershipClaimResponse> => {
      try {
        return await withdraw(identity, params.claimId);
      } catch (error) {
        handleError(error);
      }
    },
    {
      requireLogin: true,
      params: workMembershipClaimActionPathParamsSchema,
      detail: {
        summary: "Withdraw a work membership claim",
        description:
          "Marks the claim WITHDRAWN. Only the original claimer may withdraw their pending claim.",
        tags: ["Units", "UnitWork"],
      },
    },
  );

export type WorkMembershipClaimApi = typeof workMembershipClaimApi;
