import type {
  CollectionStatusResponse,
  CollectResponse,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import {
  collectInputSchema,
  toggleFavoriteInputSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { collectionService } from "./collection.service";

export const collectionApi = new Elysia({ prefix: "/collect" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity }): Promise<CollectResponse> => {
      return collectionService.collect(identity.userId, body);
    },
    {
      requireLogin: true,
      body: collectInputSchema,
      detail: {
        summary: "Collect a unit",
        description:
          "Save a unit to multiple shelves. Reviews auto-collect the target work (review id is appended to the slot's reviewIds).",
        tags: ["Collection"],
      },
    },
  )
  .post(
    "/toggle-favorite",
    async ({ body, identity }): Promise<ToggleFavoriteResponse> => {
      return collectionService.toggleFavorite(identity.userId, body.targetId);
    },
    {
      requireLogin: true,
      body: toggleFavoriteInputSchema,
      detail: {
        summary: "Toggle favorite",
        description:
          "Add or remove a unit from the user's Favorites shelf. Reviews resolve to the target work.",
        tags: ["Collection"],
      },
    },
  )
  .get(
    "/status/:targetId",
    async ({ params, identity }): Promise<CollectionStatusResponse> => {
      return collectionService.getCollectionStatus(
        identity.userId,
        params.targetId,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ targetId: t.String() }),
      detail: {
        summary: "Collection status",
        description:
          "Check which shelves contain a given unit and whether it's favorited",
        tags: ["Collection"],
      },
    },
  );

export default collectionApi;
