import type { WorkMaintenanceDTO } from "@rezics/contract";
import {
  upsertWorkMaintenanceTranslationSchema,
  workMaintenanceParamsSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { workMaintenanceService } from "./work-maintenance.service";

export const workMaintenanceApi = new Elysia({ prefix: "/work-maintenance" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<WorkMaintenanceDTO> => {
      return workMaintenanceService.get(params.unitId);
    },
    {
      params: workMaintenanceParamsSchema,
      detail: {
        summary: "Get Work maintenance identity",
        tags: ["Work Maintenance"],
      },
    },
  )
  .put(
    "/:unitId/translation",
    async ({ params, body }): Promise<WorkMaintenanceDTO> => {
      return workMaintenanceService.upsertTranslation(params.unitId, body);
    },
    {
      requireLogin: true,
      params: workMaintenanceParamsSchema,
      body: upsertWorkMaintenanceTranslationSchema,
      detail: {
        summary: "Upsert Work abstract identity translation",
        tags: ["Work Maintenance"],
      },
    },
  );

export type WorkMaintenanceApi = typeof workMaintenanceApi;
