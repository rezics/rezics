import {
  BasicAdminPermission,
  type CreateUnitInput,
  createTranslationSchema,
  createUnitSchema,
  hasPermissionToDeleteUnit,
  hasPermissionToUpdateUnit,
  translationParamsSchema,
  type UnitListQuery,
  type UnitListResponse,
  type UnitResponse,
  type UpdateUnitInput,
  unitListQuerySchema,
  unitListResponseSchema,
  unitParamsSchema,
  unitResponseSchema,
  updateTranslationSchema,
  updateUnitSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { mapUnitToDTO, mapTranslationToDTO } from "./mapper";
import { translationService } from "./translation.service";
import { unitService } from "./unit.service";

export const unitApi = new Elysia({ prefix: "/units" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<UnitResponse> => {
      const unit = await unitService.getByUnitId(params.unitId);
      return mapUnitToDTO(unit);
    },
    {
      params: unitParamsSchema,
      response: unitResponseSchema,
      detail: {
        summary: "Get unit",
        description: "Get a single Unit (with relations) by its id",
        tags: ["Units"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<UnitResponse> => {
      const createReq: CreateUnitInput = {
        ...body,
        userId: identity.unitId,
      };
      const unit = await unitService.create(createReq);
      return mapUnitToDTO(unit);
    },
    {
      requireLogin: true,
      body: createUnitSchema,
      response: unitResponseSchema,
      detail: {
        summary: "Create unit",
        description:
          "Create a new Unit with optional inline translations. Type must be one of UnitType.",
        tags: ["Units"],
      },
    },
  )
  .get(
    "/",
    async ({ query, identity, set }): Promise<UnitListResponse> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to list all units",
        );
      }
      const { units, total } = await unitService.list(query as UnitListQuery);
      return { units: units.map(mapUnitToDTO), total };
    },
    {
      requireLogin: true,
      query: unitListQuerySchema,
      response: unitListResponseSchema,
      detail: {
        summary: "List units",
        description:
          "List Units with search, filtering by type/status/visibility/language/user, and pagination with cursor or offset.",
        tags: ["Units"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<UnitResponse> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(identity.permission, identity.unitId, target as any)
      ) {
        set.status = 403;
        throw new Error("Forbidden: you do not own this unit");
      }
      const unit = await unitService.update(
        params.unitId,
        body as UpdateUnitInput,
      );
      return mapUnitToDTO(unit);
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      body: updateUnitSchema,
      response: unitResponseSchema,
      detail: {
        summary: "Update unit",
        description: "Update mutable fields of a Unit by id",
        tags: ["Units"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({
      params,
      identity,
      set,
    }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeleteUnit(identity.permission, identity.unitId, target as any)
      ) {
        set.status = 403;
        throw new Error("Forbidden: you do not own this unit");
      }
      await unitService.delete(params.unitId);
      return { message: "Unit deleted successfully" };
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      detail: {
        summary: "Delete unit",
        description: "Delete a Unit by id (cascades to related indexes)",
        tags: ["Units"],
      },
    },
  )
  // ─── Translation CRUD ────────────────────────────────────────
  .get(
    "/:unitId/translations/:language",
    async ({ params }) => {
      const translation = await translationService.getTranslation(
        params.unitId,
        params.language,
      );
      return mapTranslationToDTO(translation as any);
    },
    {
      params: translationParamsSchema,
      detail: {
        summary: "Get translation",
        description: "Get a single translation by unit ID and language",
        tags: ["Units", "Translations"],
      },
    },
  )
  .put(
    "/:unitId/translations/:language",
    async ({ params, body, identity, set }) => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(identity.permission, identity.unitId, target as any)
      ) {
        set.status = 403;
        throw new Error("Forbidden: you do not own this unit");
      }
      const translation = await translationService.upsertTranslation(
        params.unitId,
        params.language,
        body,
      );
      return mapTranslationToDTO(translation as any);
    },
    {
      requireLogin: true,
      params: translationParamsSchema,
      body: updateTranslationSchema,
      detail: {
        summary: "Upsert translation",
        description:
          "Create or update a translation for a Unit by language code",
        tags: ["Units", "Translations"],
      },
    },
  )
  .delete(
    "/:unitId/translations/:language",
    async ({
      params,
      identity,
      set,
    }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(identity.permission, identity.unitId, target as any)
      ) {
        set.status = 403;
        throw new Error("Forbidden: you do not own this unit");
      }
      await translationService.deleteTranslation(
        params.unitId,
        params.language,
      );
      return { message: "Translation deleted successfully" };
    },
    {
      requireLogin: true,
      params: translationParamsSchema,
      detail: {
        summary: "Delete translation",
        description: "Delete a translation for a Unit by language code",
        tags: ["Units", "Translations"],
      },
    },
  );

export type UnitApi = typeof unitApi;
