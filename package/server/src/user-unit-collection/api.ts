import type { UserUnitCollectionDTO } from "@rezics/contract";
import {
  patchUserUnitCollectionSchema,
  userUnitCollectionDTOSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { mapUserUnitCollectionToDTO } from "./mapper";
import { userUnitCollectionService } from "./service";

const unitParamsSchema = t.Object({
  unitId: t.String(),
});

export const userUnitCollectionApi = new Elysia({
  prefix: "/user-unit-collection",
})
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params, identity }): Promise<UserUnitCollectionDTO | null> => {
      const row = await userUnitCollectionService.get(
        identity.userId,
        params.unitId,
      );
      return row ? mapUserUnitCollectionToDTO(row) : null;
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      response: t.Nullable(userUnitCollectionDTOSchema),
      detail: {
        summary: "Get my collection metadata for a Unit",
        tags: ["Collection"],
      },
    },
  )
  .patch(
    "/:unitId",
    async ({
      params,
      body,
      identity,
    }): Promise<UserUnitCollectionDTO | null> => {
      const row = await userUnitCollectionService.patch(identity.userId, {
        ...body,
        unitId: params.unitId,
      });
      return row ? mapUserUnitCollectionToDTO(row) : null;
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      body: patchUserUnitCollectionSchema,
      response: t.Nullable(userUnitCollectionDTOSchema),
      detail: {
        summary: "Patch my collection metadata for a Unit",
        tags: ["Collection"],
      },
    },
  );
