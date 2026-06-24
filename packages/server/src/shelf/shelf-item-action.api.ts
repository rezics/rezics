import type {
  ShelfItemStatusBatchResponse,
  ShelfItemStatusResponse,
  AddToShelvesResponse,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import {
  addToShelvesInputSchema,
  shelfItemStatusBatchRequestSchema,
  toggleFavoriteInputSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { shelfItemActionService } from "./shelf-item-action.service";

export const shelfItemActionApi = new Elysia({ prefix: "/shelf" })
  .use(authMacro)
  .post(
    "/items/add",
    async ({ body, identity }): Promise<AddToShelvesResponse> => {
      return shelfItemActionService.addToShelves(identity.userId, body);
    },
    {
      requireLogin: true,
      body: addToShelvesInputSchema,
      detail: {
        summary: "Add a unit to shelves",
        description:
          "Save a unit to multiple shelves. Reviews auto-add the target work and add a role='review' ShelfItem child.",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/system/favorites/toggle",
    async ({ body, identity }): Promise<ToggleFavoriteResponse> => {
      return shelfItemActionService.toggleFavorite(
        identity.userId,
        body.targetId,
      );
    },
    {
      requireLogin: true,
      body: toggleFavoriteInputSchema,
      detail: {
        summary: "Toggle favorite",
        description:
          "Add or remove a unit from the user's Favorites shelf. Reviews resolve to the target work.",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/items/status/batch",
    async ({ body, identity }): Promise<ShelfItemStatusBatchResponse> => {
      return shelfItemActionService.getShelfItemStatusBatch(
        identity.userId,
        body.targetIds,
      );
    },
    {
      requireLogin: true,
      body: shelfItemStatusBatchRequestSchema,
      detail: {
        summary: "Shelf item status batch",
        description:
          "Check shelf containment status for multiple units in one request",
        tags: ["Shelves"],
      },
    },
  )
  .get(
    "/items/status/:targetId",
    async ({ params, identity }): Promise<ShelfItemStatusResponse> => {
      return shelfItemActionService.getShelfItemStatus(
        identity.userId,
        params.targetId,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ targetId: t.String() }),
      detail: {
        summary: "Shelf item status",
        description:
          "Check which shelves contain a given unit and whether it's favorited",
        tags: ["Shelves"],
      },
    },
  );

export default shelfItemActionApi;
