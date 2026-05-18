import {
  createEntitySchema,
  type EntityDTO,
  entityBySlugParamsSchema,
  entityListQuerySchema,
  entityListResponseSchema,
  entityParamsSchema,
  updateEntitySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { mapEntityToDTO } from "./entity.mapper";
import { entityService } from "./entity.service";

/**
 * Entity HTTP surface mounted at `/entity`.
 *
 * - `GET /entity/by-slug/:slug` — public lookup
 * - `GET /entity/:unitId` — public lookup
 * - `GET /entity` — public list (kind / q / ownerUnitId filters, pagination)
 * - `POST /entity` — authenticated; any logged-in user can create. The
 *   service rejects `slug` and `verified` from non-admin callers.
 * - `PATCH /entity/:unitId` — authenticated; service-layer gate enforces
 *   admin-only-after-verified slug write and admin-only verified toggle.
 * - `DELETE /entity/:unitId` — admin only.
 */
export const entityApi = new Elysia({ prefix: "/entity" })
  .use(authMacro)

  .get(
    "/by-slug/:slug",
    async ({ params, set }) => {
      const row = await entityService.getBySlug(params.slug);
      if (!row) {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Entity not found" } };
      }
      return mapEntityToDTO(row);
    },
    {
      params: entityBySlugParamsSchema,
      detail: {
        summary: "Get entity by slug",
        description:
          "Resolve an ENTITY-scope slug. Returns 404 when no entity carries that slug.",
        tags: ["Entity"],
      },
    },
  )

  .get(
    "/",
    async ({ query }): Promise<{ entities: EntityDTO[]; total: number }> => {
      const { rows, total } = await entityService.list(query);
      return { entities: rows.map(mapEntityToDTO), total };
    },
    {
      query: entityListQuerySchema,
      response: { 200: entityListResponseSchema },
      detail: {
        summary: "List entities",
        description:
          "Paginated list with optional `kind`, `verified`, `ownerUnitId`, `q`, and `ids` filters.",
        tags: ["Entity"],
      },
    },
  )

  .get(
    "/:unitId",
    async ({ params, set }) => {
      const row = await entityService.getByUnitId(params.unitId);
      if (!row) {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Entity not found" } };
      }
      return mapEntityToDTO(row);
    },
    {
      params: entityParamsSchema,
      detail: {
        summary: "Get entity by unitId",
        tags: ["Entity"],
      },
    },
  )

  .post(
    "/",
    async ({ body, identity }): Promise<EntityDTO> => {
      const isAdmin =
        isAdminRole(identity) || (await verifyAdminFromDb(identity.userId));
      const row = await entityService.create(body, {
        callerUnitId: identity.userId,
        isAdmin,
      });
      return mapEntityToDTO(row);
    },
    {
      requireLogin: true,
      body: createEntitySchema,
      detail: {
        summary: "Create entity",
        description:
          "Create an entity owned by the caller. `slug` and `verified` are silently rejected for non-admin callers; admins must set `verified=true` in the same payload to also set a `slug`.",
        tags: ["Entity"],
      },
    },
  )

  .patch(
    "/:unitId",
    async ({ params, body, identity }): Promise<EntityDTO> => {
      const isAdmin =
        isAdminRole(identity) || (await verifyAdminFromDb(identity.userId));
      const row = await entityService.update(params.unitId, body, {
        callerUnitId: identity.userId,
        isAdmin,
      });
      return mapEntityToDTO(row);
    },
    {
      requireLogin: true,
      params: entityParamsSchema,
      body: updateEntitySchema,
      detail: {
        summary: "Update entity",
        description:
          "Update kind, translations, and (admin-only) `verified` / `slug`. Slug writes require admin AND `verified=true`.",
        tags: ["Entity"],
      },
    },
  )

  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const isAdmin =
        isAdminRole(identity) || (await verifyAdminFromDb(identity.userId));
      if (!isAdmin) {
        set.status = 403;
        throw new Error("Forbidden: admin permission required");
      }
      await entityService.delete(params.unitId);
      return { message: "Entity deleted successfully" };
    },
    {
      requireLogin: true,
      params: entityParamsSchema,
      detail: {
        summary: "Delete entity",
        description:
          "Admin-only delete; cascades to translations, credit attributions, and subject attributions.",
        tags: ["Entity"],
      },
    },
  );
