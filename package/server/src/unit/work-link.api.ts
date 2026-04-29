import {
  workLinkBodySchema,
  workLinkPathParamsSchema,
  type WorkLinkResponse,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro } from "@/middleware";
import { applyWorkLink, WorkLinkError } from "./work-link.service";

export const workLinkApi = new Elysia({ prefix: "/unit" })
  .use(authMacro)
  .patch(
    "/:releaseId/work-link",
    async ({ params, body, identity }): Promise<WorkLinkResponse> => {
      try {
        return await applyWorkLink(identity, params.releaseId, body.workUnitId);
      } catch (error) {
        if (error instanceof WorkLinkError) {
          throw status(error.httpStatus, {
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    },
    {
      requireLogin: true,
      params: workLinkPathParamsSchema,
      body: workLinkBodySchema,
      detail: {
        summary: "Set or clear the work link of a release Unit",
        description:
          "PATCH /unit/:releaseId/work-link — when the caller has authority over both sides (or the work is a wiki type), links immediately; otherwise creates a PENDING WorkLinkClaim. Pass `workUnitId: null` to unlink and withdraw any pending claims.",
        tags: ["Units", "WorkLink"],
      },
    },
  );

export type WorkLinkApi = typeof workLinkApi;
