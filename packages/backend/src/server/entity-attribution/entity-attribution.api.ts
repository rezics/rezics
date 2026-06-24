import type { EntityAttributionBatchResponse } from "@rezics/contract";
import {
  entityAttributionBatchParamsSchema,
  entityAttributionBatchRequestSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { entityAttributionBatchService } from "./entity-attribution.service";

export const entityAttributionApi = new Elysia({ prefix: "/unit" })
  .use(authMacro)
  .patch(
    "/:unitId/entity-attributions/batch",
    async ({
      params,
      body,
      identity,
    }): Promise<EntityAttributionBatchResponse> => {
      return entityAttributionBatchService.batchUpdate(
        params.unitId,
        body,
        identity,
      );
    },
    {
      requireLogin: true,
      params: entityAttributionBatchParamsSchema,
      body: entityAttributionBatchRequestSchema,
      detail: {
        summary: "Batch update entity attributions for a unit",
        description:
          "Reconcile final credit and subject attribution sets for a target Unit as one canonical metadata commit.",
        tags: ["Entity Attribution"],
      },
    },
  );
