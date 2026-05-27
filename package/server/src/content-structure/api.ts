import type {
  ContentStructureItem,
  ContentStructureResponse,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { contentStructureService } from "./service";

const ownerParamsSchema = t.Object({
  ownerUnitId: t.String(),
});

export const contentStructureApi = new Elysia({
  prefix: "/content-structure",
})
  .use(authMacro)
  .get(
    "/:ownerUnitId",
    async ({ params }): Promise<ContentStructureResponse> => {
      return contentStructureService.getByOwnerUnitId(params.ownerUnitId);
    },
    {
      params: ownerParamsSchema,
      detail: {
        summary: "Get content structure",
        description: "Get generic content structure by owner Unit ID",
        tags: ["Content Structure"],
      },
    },
  )
  .put(
    "/:ownerUnitId",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<ContentStructureResponse> => {
      const ownerUnit = await unitService.getByUnitId(params.ownerUnitId);
      if (!ownerUnit) {
        set.status = 404;
        throw new Error(`Owner Unit not found: ${params.ownerUnitId}`);
      }

      return contentStructureService.update(
        params.ownerUnitId,
        body as ContentStructureItem[],
        {
          actorUserId: identity.userId,
        },
      );
    },
    {
      requireLogin: true,
      params: ownerParamsSchema,
      body: t.Any(),
      detail: {
        summary: "Update content structure",
        description: "Update generic content structure by owner Unit ID",
        tags: ["Content Structure"],
      },
    },
  );
