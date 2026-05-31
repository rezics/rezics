import type {
  CollectionSearchResponse,
  UserUnitCollectionDTO,
} from "@rezics/contract";
import {
  collectionSearchQuerySchema,
  collectionSearchResponseSchema,
  patchUserUnitCollectionSchema,
  userUnitCollectionDTOSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, tryResolveIdentity } from "@/middleware";
import { mapCollectionUnitToDTO, mapUserUnitCollectionToDTO } from "./mapper";
import { userUnitCollectionService } from "./service";

const unitParamsSchema = t.Object({
  unitId: t.String(),
});

export const userUnitCollectionApi = new Elysia({
  prefix: "/user-unit-collection",
})
  .use(authMacro)
  .get(
    "/search/me",
    async ({ query, identity }): Promise<CollectionSearchResponse> => {
      const result = await userUnitCollectionService.search(
        identity.userId,
        query,
        { viewerUserId: identity.userId },
      );
      return {
        units: result.units.map(mapCollectionUnitToDTO),
        hasMore: result.hasMore,
      };
    },
    {
      requireLogin: true,
      query: collectionSearchQuerySchema,
      response: collectionSearchResponseSchema,
      detail: {
        summary: "Search my collection across shelves",
        tags: ["Collection"],
      },
    },
  )
  .get(
    "/search/user/:userId",
    async ({ headers, params, query }): Promise<CollectionSearchResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      const result = await userUnitCollectionService.search(
        params.userId,
        query,
        {
          viewerUserId: identity?.userId,
          publicOnly: identity?.userId !== params.userId,
        },
      );
      return {
        units: result.units.map(mapCollectionUnitToDTO),
        hasMore: result.hasMore,
      };
    },
    {
      params: t.Object({ userId: t.String() }),
      query: collectionSearchQuerySchema,
      response: collectionSearchResponseSchema,
      detail: {
        summary: "Search a user's public collection across public shelves",
        tags: ["Collection"],
      },
    },
  )
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
