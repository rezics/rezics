import {
  type UnitWorkMembershipResponse,
  unitWorkMembershipBodySchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro } from "@/middleware";
import {
  applyUnitWorkMembership,
  UnitWorkMembershipError,
} from "./unit-work-membership.service";

// Param name `unitId` matches `unitApi`'s — memoirist requires param names to agree at the same trie position.
const releasePathParamsSchema = t.Object({
  unitId: t.String(),
});

export const unitWorkMembershipApi = new Elysia({ prefix: "/unit" })
  .use(authMacro)
  .patch(
    "/:unitId/work-membership",
    async ({ params, body, identity }): Promise<UnitWorkMembershipResponse> => {
      try {
        return await applyUnitWorkMembership(
          identity,
          params.unitId,
          body.workUnitId,
        );
      } catch (error) {
        if (error instanceof UnitWorkMembershipError) {
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
      body: unitWorkMembershipBodySchema,
      detail: {
        summary: "Set or clear the work membership of a release Unit",
        description:
          "PATCH /unit/:unitId/work-membership — `:unitId` is a release Unit. When the caller has authority over both sides (or the work is a wiki type), creates membership immediately; otherwise creates a PENDING work membership claim. Pass `workUnitId: null` to clear membership and withdraw pending claims.",
        tags: ["Units", "UnitWork"],
      },
    },
  );

export type UnitWorkMembershipApi = typeof unitWorkMembershipApi;
