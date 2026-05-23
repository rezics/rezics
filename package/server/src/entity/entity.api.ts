import {
  createEntitySchema,
  editorialPatchSubmissionSchema,
  type EntityDTO,
  type EntityKind,
  entityBySlugParamsSchema,
  entityListQuerySchema,
  entityListResponseSchema,
  entityParamsSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { assertEditorialPatchAllowed } from "@/unit/collaborative-metadata";
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

  // @convention:root-list-ok
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
        actor: identity,
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
      assertEditorialPatchAllowed(body.patch);
      const isAdmin =
        isAdminRole(identity) || (await verifyAdminFromDb(identity.userId));
      const entity =
        body.patch.entity &&
        typeof body.patch.entity === "object" &&
        !Array.isArray(body.patch.entity)
          ? (body.patch.entity as Record<string, unknown>)
          : {};
      const translations =
        body.patch.translations &&
        typeof body.patch.translations === "object" &&
        !Array.isArray(body.patch.translations)
          ? Object.entries(body.patch.translations as Record<string, unknown>)
              .filter(([, value]) => value && typeof value === "object")
              .map(([language, value]) => ({
                language,
                ...(value as Record<string, unknown>),
              }))
          : undefined;
      const row = await entityService.update(
        params.unitId,
        {
          kind:
            entity.kind === null || typeof entity.kind === "string"
              ? (entity.kind as EntityKind | null)
              : undefined,
          avatar:
            entity.avatar === null || typeof entity.avatar === "string"
              ? entity.avatar
              : undefined,
          eligibleCreditRoles: Array.isArray(entity.eligibleCreditRoles)
            ? (entity.eligibleCreditRoles as never)
            : undefined,
          eligibleSubjectRoles: Array.isArray(entity.eligibleSubjectRoles)
            ? (entity.eligibleSubjectRoles as never)
            : undefined,
          slug:
            entity.slug === null || typeof entity.slug === "string"
              ? entity.slug
              : undefined,
          verified:
            typeof entity.verified === "boolean" ? entity.verified : undefined,
          translations: translations as never,
        },
        {
          callerUnitId: identity.userId,
          isAdmin,
          actor: identity,
        },
        body,
      );
      return mapEntityToDTO(row);
    },
    {
      requireLogin: true,
      params: entityParamsSchema,
      body: editorialPatchSubmissionSchema,
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
