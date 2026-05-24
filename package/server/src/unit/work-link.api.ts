import { type WorkLinkResponse, workLinkBodySchema } from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro } from "@/middleware";
import { applyWorkLink, WorkLinkError } from "./work-link.service";

// Param name `unitId` matches `unitApi`'s — memoirist requires param names to agree at the same trie position.
const releasePathParamsSchema = t.Object({
  unitId: t.String(),
});

export const workLinkApi = new Elysia({ prefix: "/unit" }).use(authMacro).patch(
  "/:unitId/work-link",
  async ({ params, body, identity }): Promise<WorkLinkResponse> => {
    try {
      return await applyWorkLink(identity, params.unitId, body.workUnitId);
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
    params: releasePathParamsSchema,
    body: workLinkBodySchema,
    detail: {
      summary: "Set or clear the work link of a release Unit",
      description:
        "PATCH /unit/:unitId/work-link — `:unitId` is a release Unit. When the caller has authority over both sides (or the work is a wiki type), links immediately; otherwise creates a PENDING WorkLinkClaim. Pass `workUnitId: null` to unlink and withdraw any pending claims.",
      tags: ["Units", "WorkLink"],
    },
  },
);

export type WorkLinkApi = typeof workLinkApi;
