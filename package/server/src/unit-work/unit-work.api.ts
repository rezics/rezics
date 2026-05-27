import type {
  UnitWorkDTO,
  UnitWorkListResponse,
  UnitWorkRole,
} from "@rezics/contract";
import {
  createUnitWorkSchema,
  listUnitWorkQuerySchema,
  unitWorkPathParamsSchema,
  updateUnitWorkSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { hasAuthorityOver } from "@/unit/authority";
import { unitService } from "@/unit/unit.service";
import { forbidden } from "@/utils/errors";
import { mapUnitWorkToDTO } from "./unit-work.mapper";
import { unitWorkService } from "./unit-work.service";

async function assertCanManageWork(identity: any, workUnitId: string) {
  const workUnit = await unitService.getByUnitId(workUnitId);
  const allowed = await hasAuthorityOver(identity, {
    id: workUnit.id,
    userId: workUnit.userId,
  });
  if (!allowed) {
    throw forbidden("you do not have permission to manage this work domain");
  }
}

export const unitWorkApi = new Elysia({ prefix: "/unit-work" })
  .use(authMacro)
  .get(
    "/list",
    async ({ query }): Promise<UnitWorkListResponse> => {
      const rows = await unitWorkService.list(query);
      return { unitWorks: rows.map(mapUnitWorkToDTO) };
    },
    {
      query: listUnitWorkQuerySchema,
      detail: {
        summary: "List UnitWork memberships",
        tags: ["UnitWork"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<UnitWorkDTO> => {
      await assertCanManageWork(identity, body.workUnitId);
      const row = await unitWorkService.create(body);
      return mapUnitWorkToDTO(row);
    },
    {
      requireLogin: true,
      body: createUnitWorkSchema,
      detail: {
        summary: "Create or update a UnitWork membership",
        tags: ["UnitWork"],
      },
    },
  )
  .patch(
    "/:workUnitId/:role/:unitId",
    async ({ params, body, identity }): Promise<UnitWorkDTO> => {
      await assertCanManageWork(identity, params.workUnitId);
      const row = await unitWorkService.update(
        params.unitId,
        params.workUnitId,
        params.role as UnitWorkRole,
        body,
      );
      return mapUnitWorkToDTO(row);
    },
    {
      requireLogin: true,
      params: unitWorkPathParamsSchema,
      body: updateUnitWorkSchema,
      detail: {
        summary: "Update UnitWork membership metadata",
        tags: ["UnitWork"],
      },
    },
  )
  .delete(
    "/:workUnitId/:role/:unitId",
    async ({ params, identity }): Promise<{ message: string }> => {
      await assertCanManageWork(identity, params.workUnitId);
      await unitWorkService.delete(
        params.unitId,
        params.workUnitId,
        params.role as UnitWorkRole,
      );
      return { message: "UnitWork membership deleted" };
    },
    {
      requireLogin: true,
      params: unitWorkPathParamsSchema,
      detail: {
        summary: "Delete a UnitWork membership",
        tags: ["UnitWork"],
      },
    },
  )
  .get(
    "/diagnostics/release-drift",
    async (): Promise<{
      drift: Awaited<ReturnType<typeof unitWorkService.getReleaseDrift>>;
    }> => {
      const drift = await unitWorkService.getReleaseDrift();
      return { drift };
    },
    {
      detail: {
        summary: "List Unit.workUnitId and UnitWork release drift",
        tags: ["UnitWork", "Diagnostics"],
      },
    },
  );

export type UnitWorkApi = typeof unitWorkApi;
