import type { ShelfDTO, ShelfItemDTO, ShelfListResponse } from "@rezics/contract";
import {
  addShelfItemSchema,
  createShelfSchema,
  hasPermissionToDeleteShelf,
  hasPermissionToUpdateShelf,
  shelfListQuerySchema,
  shelfParamsSchema,
  updateShelfItemSchema,
  updateShelfSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, buildActorFromContext } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { shelfService } from "./shelf.service";

export const shelfApi = new Elysia({ prefix: "/shelves" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<ShelfDTO> => {
      return shelfService.getByUnitId(params.unitId);
    },
    {
      params: shelfParamsSchema,
      detail: {
        summary: "Get shelf",
        description: "Get a single shelf with items by unit ID",
        tags: ["Shelves"],
      },
    },
  )
  .get(
    "/",
    async ({ query }): Promise<ShelfListResponse> => {
      const { shelves, total } = await shelfService.list(query as any);
      return { shelves, total };
    },
    {
      query: shelfListQuerySchema,
      detail: {
        summary: "List shelves",
        description: "List shelves with filtering and pagination",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<ShelfDTO> => {
      return shelfService.create(body, identity.unitId);
    },
    {
      requireLogin: true,
      body: createShelfSchema,
      detail: {
        summary: "Create shelf",
        description: "Create a new shelf",
        tags: ["Shelves"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({
      params,
      body,
      identity,
      currentUser,
      set,
    }): Promise<ShelfDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Shelf not found: ${params.unitId}`);
      }
      if (
        !hasPermissionToUpdateShelf(
          buildActorFromContext({ identity, currentUser }),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this shelf",
        );
      }
      return shelfService.update(params.unitId, body);
    },
    {
      requireOwner: true,
      params: shelfParamsSchema,
      body: updateShelfSchema,
      detail: {
        summary: "Update shelf",
        description: "Update an existing shelf by unit ID",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({
      params,
      identity,
      currentUser,
      set,
    }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeleteShelf(
          buildActorFromContext({ identity, currentUser }),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to delete this shelf",
        );
      }
      await shelfService.delete(params.unitId);
      return { message: "Shelf deleted successfully" };
    },
    {
      requireOwner: true,
      params: shelfParamsSchema,
      detail: {
        summary: "Delete shelf",
        description: "Delete a shelf by unit ID",
        tags: ["Shelves"],
      },
    },
  )
  // --- Shelf item routes ---
  .post(
    "/:unitId/items",
    async ({
      params,
      body,
      identity,
      currentUser,
      set,
    }): Promise<ShelfItemDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          buildActorFromContext({ identity, currentUser }),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      return shelfService.addItem(params.unitId, body);
    },
    {
      requireOwner: true,
      params: shelfParamsSchema,
      body: addShelfItemSchema,
      detail: {
        summary: "Add item to shelf",
        description: "Add an item to a shelf",
        tags: ["Shelves"],
      },
    },
  )
  .put(
    "/:unitId/items/:itemUnitId",
    async ({
      params,
      body,
      identity,
      currentUser,
      set,
    }): Promise<ShelfItemDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          buildActorFromContext({ identity, currentUser }),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      return shelfService.updateItem(
        params.unitId,
        params.itemUnitId,
        body,
      );
    },
    {
      requireOwner: true,
      params: t.Object({ unitId: t.String(), itemUnitId: t.String() }),
      body: updateShelfItemSchema,
      detail: {
        summary: "Update shelf item",
        description: "Update an item within a shelf",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId/items/:itemUnitId",
    async ({
      params,
      identity,
      currentUser,
      set,
    }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          buildActorFromContext({ identity, currentUser }),
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      await shelfService.removeItem(params.unitId, params.itemUnitId);
      return { message: "Item removed from shelf" };
    },
    {
      requireOwner: true,
      params: t.Object({ unitId: t.String(), itemUnitId: t.String() }),
      detail: {
        summary: "Remove item from shelf",
        description: "Remove an item from a shelf",
        tags: ["Shelves"],
      },
    },
  );

export default shelfApi;
