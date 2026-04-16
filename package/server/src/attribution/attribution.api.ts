import type {
  AttributionDTO,
  EntityDTO,
} from "@rezics/contract";
import {
  BasicAdminPermission,
  createEntitySchema,
  entityListQuerySchema,
  entityParamsSchema,
  linkAttributionSchema,
  updateEntitySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { attributionService } from "./attribution.service";

export const attributionApi = new Elysia({ prefix: "/attribution" })
  .use(authMacro)
  // --- Entity routes ---
  .get(
    "/entities",
    async ({
      query,
    }): Promise<{ entities: EntityDTO[]; total: number }> => {
      return attributionService.listEntities(query as any);
    },
    {
      query: entityListQuerySchema,
      detail: {
        summary: "List entities",
        description:
          "List entities with filtering by kind and search query",
        tags: ["Attribution"],
      },
    },
  )
  .get(
    "/entities/:id",
    async ({ params }): Promise<EntityDTO> => {
      return attributionService.getEntityById(params.id);
    },
    {
      params: entityParamsSchema,
      detail: {
        summary: "Get entity",
        description: "Get a single entity by ID",
        tags: ["Attribution"],
      },
    },
  )
  .post(
    "/entities",
    async ({ body, identity, set }): Promise<EntityDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.createEntity(body);
    },
    {
      requireLogin: true,
      body: createEntitySchema,
      detail: {
        summary: "Create entity",
        description: "Create a new entity (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .put(
    "/entities/:id",
    async ({ params, body, identity, set }): Promise<EntityDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.updateEntity(params.id, body);
    },
    {
      requireLogin: true,
      params: entityParamsSchema,
      body: updateEntitySchema,
      detail: {
        summary: "Update entity",
        description: "Update an entity (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .delete(
    "/entities/:id",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await attributionService.deleteEntity(params.id);
      return { message: "Entity deleted successfully" };
    },
    {
      requireLogin: true,
      params: entityParamsSchema,
      detail: {
        summary: "Delete entity",
        description: "Delete an entity (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  // --- Credit link routes ---
  .post(
    "/credits",
    async ({ body, identity, set }): Promise<AttributionDTO> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      return attributionService.linkAttribution(body);
    },
    {
      requireLogin: true,
      body: linkAttributionSchema,
      detail: {
        summary: "Link attribution",
        description: "Link an entity to a unit with a role (admin only)",
        tags: ["Attribution"],
      },
    },
  )
  .delete(
    "/credits/:unitId/:entityId/:role",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await attributionService.unlinkAttribution(
        params.unitId,
        params.entityId,
        params.role,
      );
      return { message: "Attribution unlinked" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        entityId: t.String(),
        role: t.String(),
      }),
      detail: {
        summary: "Unlink attribution",
        description: "Unlink an entity from a unit (admin only)",
        tags: ["Attribution"],
      },
    },
  );

export default attributionApi;
