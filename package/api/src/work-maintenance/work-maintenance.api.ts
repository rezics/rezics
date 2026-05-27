import type {
  UpsertWorkMaintenanceTranslationInput,
  WorkMaintenanceDTO,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const workMaintenanceApi = {
  get: async (unitId: string): Promise<WorkMaintenanceDTO> => {
    return apiFetch<WorkMaintenanceDTO>(`/work-maintenance/${unitId}`);
  },

  upsertTranslation: async (
    unitId: string,
    input: UpsertWorkMaintenanceTranslationInput,
  ): Promise<WorkMaintenanceDTO> => {
    return apiFetch<WorkMaintenanceDTO>(
      `/work-maintenance/${unitId}/translation`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },
};
