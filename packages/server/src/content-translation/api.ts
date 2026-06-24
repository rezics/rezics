import type {
  ContentTranslationListResponse,
  ContentTranslationResponse,
} from "@rezics/contract";
import {
  contentTranslationListResponseSchema,
  contentTranslationParamsSchema,
  contentTranslationResponseSchema,
  contentTranslationUnitParamsSchema,
  upsertContentTranslationSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { mapContentTranslationToDTO } from "./mapper";
import { contentTranslationService } from "./service";

export const contentTranslationApi = new Elysia({
  prefix: "/content-translation",
})
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<ContentTranslationListResponse> => {
      const rows = await contentTranslationService.list(params.unitId);
      return { translations: rows.map(mapContentTranslationToDTO) };
    },
    {
      params: contentTranslationUnitParamsSchema,
      response: contentTranslationListResponseSchema,
      detail: {
        summary: "List content translations for a Unit",
        tags: ["Content translations"],
      },
    },
  )
  .get(
    "/:unitId/:language",
    async ({ params }): Promise<ContentTranslationResponse> => {
      return mapContentTranslationToDTO(
        await contentTranslationService.get(params.unitId, params.language),
      );
    },
    {
      params: contentTranslationParamsSchema,
      response: contentTranslationResponseSchema,
      detail: {
        summary: "Get content translation",
        tags: ["Content translations"],
      },
    },
  )
  .put(
    "/:unitId/:language",
    async ({ params, body, identity }): Promise<ContentTranslationResponse> => {
      return mapContentTranslationToDTO(
        await contentTranslationService.upsert(
          {
            ...body,
            unitId: params.unitId,
            language: params.language,
          },
          identity.userId,
        ),
      );
    },
    {
      requireLogin: true,
      params: contentTranslationParamsSchema,
      body: upsertContentTranslationSchema,
      response: contentTranslationResponseSchema,
      detail: {
        summary: "Upsert content translation",
        tags: ["Content translations"],
      },
    },
  )
  .delete(
    "/:unitId/:language",
    async ({ params }): Promise<{ message: string }> => {
      await contentTranslationService.delete(params.unitId, params.language);
      return { message: "Content translation deleted" };
    },
    {
      requireLogin: true,
      params: contentTranslationParamsSchema,
      response: t.Object({ message: t.String() }),
      detail: {
        summary: "Delete content translation",
        tags: ["Content translations"],
      },
    },
  );
