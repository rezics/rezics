import type {
  UserShelfItemsSearchResponse,
  UserShelfItemMetadataDTO,
} from "@rezics/contract";
import {
  patchUserShelfItemMetadataSchema,
  userShelfItemMetadataDTOSchema,
  userShelfItemDTOSchema,
  userShelfItemsSearchQuerySchema,
  userShelfItemsSearchResponseSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, tryResolveIdentity } from "@/middleware";
import {
  mapUserShelfItemMetadataToDTO,
  mapUserShelfItemToDTO,
} from "./user-shelf-item.mapper";
import { userShelfItemService } from "./user-shelf-item.service";

const unitParamsSchema = t.Object({
  unitId: t.String(),
});

export const userShelfItemApi = new Elysia({
  prefix: "/shelf/item",
})
  .use(authMacro)
  .get(
    "/search/me",
    async ({ query, identity }): Promise<UserShelfItemsSearchResponse> => {
      const result = await userShelfItemService.search(identity.userId, query, {
        viewerUserId: identity.userId,
      });
      return {
        units: result.units.map(mapUserShelfItemToDTO),
        hasMore: result.hasMore,
      };
    },
    {
      requireLogin: true,
      query: userShelfItemsSearchQuerySchema,
      response: userShelfItemsSearchResponseSchema,
      detail: {
        summary: "Search my shelf items across shelves",
        tags: ["Shelves"],
      },
    },
  )
  .get(
    "/search/user/:userId",
    async ({
      headers,
      params,
      query,
    }): Promise<UserShelfItemsSearchResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const result = await userShelfItemService.search(params.userId, query, {
        viewerUserId: identity?.userId,
        publicOnly: identity?.userId !== params.userId,
      });
      return {
        units: result.units.map(mapUserShelfItemToDTO),
        hasMore: result.hasMore,
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      query: userShelfItemsSearchQuerySchema,
      response: userShelfItemsSearchResponseSchema,
      detail: {
        summary: "Search a user's public shelf items across public shelves",
        tags: ["Shelves"],
      },
    },
  )
  .get(
    "/metadata/:unitId",
    async ({ params, identity }): Promise<UserShelfItemMetadataDTO | null> => {
      const row = await userShelfItemService.get(
        identity.userId,
        params.unitId,
      );
      return row ? mapUserShelfItemMetadataToDTO(row) : null;
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      response: t.Nullable(userShelfItemMetadataDTOSchema),
      detail: {
        summary: "Get my shelf item metadata for a Unit",
        tags: ["Shelves"],
      },
    },
  )
  .patch(
    "/metadata/:unitId",
    async ({
      params,
      body,
      identity,
    }): Promise<UserShelfItemMetadataDTO | null> => {
      const row = await userShelfItemService.patch(identity.userId, {
        ...body,
        unitId: params.unitId,
      });
      return row ? mapUserShelfItemMetadataToDTO(row) : null;
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      body: patchUserShelfItemMetadataSchema,
      response: t.Nullable(userShelfItemMetadataDTOSchema),
      detail: {
        summary: "Patch my shelf item metadata for a Unit",
        tags: ["Shelves"],
      },
    },
  );
