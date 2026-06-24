import type {
  EntityAttributionBatchRequest,
  EntityAttributionBatchResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const entityAttributionApi = {
  batchUpdate: async (
    unitId: string,
    request: EntityAttributionBatchRequest,
  ): Promise<EntityAttributionBatchResponse> => {
    return apiFetch<EntityAttributionBatchResponse>(
      `/unit/${unitId}/entity-attributions/batch`,
      {
        method: "PATCH",
        body: JSON.stringify(request),
      },
    );
  },
};
