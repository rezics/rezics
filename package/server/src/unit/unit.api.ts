import {
  BasicAdminPermission,
  type CreateUnitInput,
  createTranslationSchema,
  createUnitSchema,
  editorialPatchSubmissionSchema,
  hasPermissionToDeleteUnit,
  hasPermissionToUpdateUnit,
  translationParamsSchema,
  type UnitLanguageAvailabilityResponse,
  type UnitLanguageContentResponse,
  type UnitListQuery,
  type UnitListResponse,
  type UnitResponse,
  type UpdateTranslationInput,
  type UpdateUnitInput,
  parseReadLanguages,
  unitLanguageAvailabilityResponseSchema,
  unitLanguageContentQuerySchema,
  unitLanguageContentResponseSchema,
  unitListBodySchema,
  unitListQuerySchema,
  unitListResponseSchema,
  unitParamsSchema,
  unitResponseSchema,
  updateUnitSchema,
  validateSlug,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { assertEditorialPatchAllowed } from "./collaborative-metadata";
import { unitLanguageService } from "./language-resolution";
import {
  mapTranslationToDTO,
  mapUnitListItemToDTO,
  mapUnitToDTO,
} from "./mapper";
import { translationService } from "./translation.service";
import { unitService } from "./unit.service";

export const unitApi = new Elysia({ prefix: "/unit" })
  .use(authMacro)
  .get(
    "/:unitId/languages",
    async ({ params }): Promise<UnitLanguageAvailabilityResponse> => {
      return unitLanguageService.availability(params.unitId);
    },
    {
      params: unitParamsSchema,
      response: unitLanguageAvailabilityResponseSchema,
      detail: {
        summary: "Get unit language availability",
        description:
          "Returns support languages and translation/body availability without hydrating the full Unit.",
        tags: ["Units"],
      },
    },
  )
  .get(
    "/:unitId/languages/content",
    async ({ params, query }): Promise<UnitLanguageContentResponse> => {
      return unitLanguageService.content(params.unitId, query);
    },
    {
      params: unitParamsSchema,
      query: unitLanguageContentQuerySchema,
      response: unitLanguageContentResponseSchema,
      detail: {
        summary: "Get resolved unit language content",
        description:
          "Resolves UnitTranslation metadata plus ContentTranslation body for a Unit/language.",
        tags: ["Units"],
      },
    },
  )
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
        userId: identity.userId,
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
    "/list",
    async ({ query, identity, set }): Promise<UnitListResponse> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to list all units",
        );
      }
      const { units, total } = await unitService.list(query as UnitListQuery);
      const languages = parseReadLanguages(query.languages);
      return {
        units: units.map((unit) => mapUnitListItemToDTO(unit, languages)),
        total,
      };
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
  .post(
    "/list",
    async ({ body, identity, set }): Promise<UnitListResponse> => {
      if (!BasicAdminPermission(identity.permission)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to list all units",
        );
      }
      const { units, total } = await unitService.list({
        ...body,
        ids: body.ids?.join(","),
      } as UnitListQuery);
      return {
        units: units.map((unit) =>
          mapUnitListItemToDTO(unit, body.languages ?? []),
        ),
        total,
      };
    },
    {
      requireLogin: true,
      body: unitListBodySchema,
      response: unitListResponseSchema,
      detail: {
        summary: "List units (POST)",
        description:
          "List units via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Units"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<UnitResponse> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(
          identity.permission,
          identity.userId,
          target as any,
        )
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
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeleteUnit(
          identity.permission,
          identity.userId,
          target as any,
        )
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
  // ─── Slug ────────────────────────────────────────────────────
  .put(
    "/:unitId/slug",
    async ({ params, body, identity, set }) => {
      const target = await unitService.getByUnitId(params.unitId);

      // Type-gate: only TAG, REALM, and ZONE
      if (
        target.type !== "TAG" &&
        target.type !== "REALM" &&
        target.type !== "ZONE"
      ) {
        set.status = 400;
        return {
          error: {
            code: "INVALID_UNIT_TYPE",
            message: "Slugs are only supported for TAG, REALM, and ZONE units",
          },
        };
      }

      // Write-once: reject if slug already set and caller is not admin
      if (target.slug !== null) {
        const isAdmin = await verifyAdminFromDb(identity.userId);
        if (!isAdmin) {
          set.status = 403;
          return {
            error: {
              code: "SLUG_IMMUTABLE",
              message: "Slug cannot be modified once set",
            },
          };
        }
      }

      // Permission: must own the unit or be admin
      if (
        !hasPermissionToUpdateUnit(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        return {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to update this unit",
          },
        };
      }

      // Validate
      const validation = validateSlug(body.slug);
      if (!validation.ok) {
        set.status = 400;
        return {
          error: {
            code: "INVALID_SLUG",
            message: `Invalid slug: ${validation.reason}`,
          },
        };
      }

      const updated = await unitService.setSlug(
        params.unitId,
        validation.normalized,
      );
      return mapUnitToDTO(updated);
    },
    {
      requireLogin: true,
      params: unitParamsSchema,
      body: t.Object({ slug: t.String({ minLength: 1 }) }),
      detail: {
        summary: "Set unit slug",
        description:
          "Set or update the slug on a TAG, REALM, or ZONE unit. Write-once for non-admins.",
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
      assertEditorialPatchAllowed(body.patch);
      const translations =
        body.patch.translations &&
        typeof body.patch.translations === "object" &&
        !Array.isArray(body.patch.translations)
          ? (body.patch.translations as Record<string, unknown>)
          : {};
      const translationPatch =
        translations[params.language] &&
        typeof translations[params.language] === "object" &&
        !Array.isArray(translations[params.language])
          ? (translations[params.language] as Record<string, unknown>)
          : {};
      const translation = await translationService.upsertTranslation(
        params.unitId,
        params.language,
        {
          title:
            translationPatch.title === null ||
            typeof translationPatch.title === "string"
              ? translationPatch.title
              : undefined,
          subtitle:
            translationPatch.subtitle === null ||
            typeof translationPatch.subtitle === "string"
              ? translationPatch.subtitle
              : undefined,
          summary:
            translationPatch.summary === null ||
            typeof translationPatch.summary === "string"
              ? translationPatch.summary
              : undefined,
          description:
            translationPatch.description === null ||
            (typeof translationPatch.description === "object" &&
              !Array.isArray(translationPatch.description))
              ? translationPatch.description
              : undefined,
          extra:
            translationPatch.extra === null ||
            (typeof translationPatch.extra === "object" &&
              !Array.isArray(translationPatch.extra))
              ? (translationPatch.extra as Record<string, unknown> | null)
              : undefined,
          sourceUnitId:
            translationPatch.sourceUnitId === null ||
            typeof translationPatch.sourceUnitId === "string"
              ? translationPatch.sourceUnitId
              : undefined,
        } as UpdateTranslationInput,
        identity,
        body,
      );
      return mapTranslationToDTO(translation as any);
    },
    {
      requireLogin: true,
      params: translationParamsSchema,
      body: editorialPatchSubmissionSchema,
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
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateUnit(
          identity.permission,
          identity.userId,
          target as any,
        )
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
