import type {
  ReorderUserTagApplicationInput,
  UserTagApplicationDTO,
} from "@rezics/contract";
import {
  reorderUserTagApplicationSchema,
  setUserTagApplicationsSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { mapUserTagApplicationToDTO } from "./user-tag-application.mapper";
import { userTagApplicationService } from "./user-tag-application.service";

const unitParamsSchema = t.Object({
  unitId: t.String(),
});

const tagParamsSchema = t.Object({
  unitId: t.String(),
  tagUnitId: t.String(),
});

export const userTagApplicationApi = new Elysia({
  prefix: "/user-tag-application",
})
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params, identity }): Promise<UserTagApplicationDTO[]> => {
      const rows = await userTagApplicationService.listForUnit(
        identity.userId,
        params.unitId,
      );
      return rows.map(mapUserTagApplicationToDTO);
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      detail: {
        summary: "List my user tags for a Unit",
        description:
          "Returns direct user-to-unit tag applications. These rows do not prove shelf containment.",
        tags: ["Collection", "Tags"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity }): Promise<UserTagApplicationDTO[]> => {
      const rows = await userTagApplicationService.setForUnit(identity.userId, {
        ...body,
        unitId: params.unitId,
      });
      return rows.map(mapUserTagApplicationToDTO);
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      body: setUserTagApplicationsSchema,
      detail: {
        summary: "Replace my user tags for a Unit",
        tags: ["Collection", "Tags"],
      },
    },
  )
  .patch(
    "/:unitId/:tagUnitId/position",
    async ({ params, body, identity }): Promise<UserTagApplicationDTO> => {
      const input: ReorderUserTagApplicationInput = {
        ...body,
        unitId: params.unitId,
        tagUnitId: params.tagUnitId,
      };
      const row = await userTagApplicationService.reorder(
        identity.userId,
        input,
      );
      return mapUserTagApplicationToDTO(row);
    },
    {
      requireLogin: true,
      params: tagParamsSchema,
      body: reorderUserTagApplicationSchema,
      detail: {
        summary: "Reorder one user tag application",
        tags: ["Collection", "Tags"],
      },
    },
  )
  .delete(
    "/:unitId/:tagUnitId",
    async ({ params, identity }): Promise<{ message: string }> => {
      await userTagApplicationService.deleteOne(
        identity.userId,
        params.unitId,
        params.tagUnitId,
      );
      return { message: "User tag application deleted" };
    },
    {
      requireLogin: true,
      params: tagParamsSchema,
      detail: {
        summary: "Delete one user tag application",
        tags: ["Collection", "Tags"],
      },
    },
  );
