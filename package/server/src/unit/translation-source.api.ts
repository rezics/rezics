import {
  type TranslationSourceResponse,
  translationSourceBodySchema,
  translationSourcePathParamsSchema,
  translationSourceResponseSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro } from "@/middleware";
import {
  setTranslationSource,
  TranslationSourceError,
} from "./translation-source.service";

export const translationSourceApi = new Elysia({ prefix: "/unit" })
  .use(authMacro)
  .patch(
    "/:workId/translations/:lang/source",
    async ({ params, body, identity }): Promise<TranslationSourceResponse> => {
      try {
        return await setTranslationSource(
          identity,
          params.workId,
          params.lang,
          body.sourceReleaseUnitId,
        );
      } catch (error) {
        if (error instanceof TranslationSourceError) {
          throw status(error.httpStatus, {
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }
    },
    {
      requireLogin: true,
      params: translationSourcePathParamsSchema,
      body: translationSourceBodySchema,
      response: translationSourceResponseSchema,
      detail: {
        summary: "Set or clear the translation source for a work",
        description:
          "PATCH /unit/:workId/translations/:lang/source — sets `UnitTranslation.sourceReleaseUnitId` for the given (workId, lang). Validates that the source is a release of this work and that the caller has authority. Existing translation fields are not touched.",
        tags: ["Units", "Translations"],
      },
    },
  );

export type TranslationSourceApi = typeof translationSourceApi;
