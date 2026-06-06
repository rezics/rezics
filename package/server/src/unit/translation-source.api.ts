import {
  languageSchema,
  type TranslationSourceResponse,
  translationSourceBodySchema,
  translationSourceResponseSchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro } from "@/middleware";
import {
  setTranslationSource,
  TranslationSourceError,
} from "./translation-source.service";

// Param name `unitId` matches `unitApi`'s — memoirist requires param names to agree at the same trie position.
const workTranslationPathParamsSchema = t.Object({
  unitId: t.String(),
  lang: languageSchema,
});

export const translationSourceApi = new Elysia({ prefix: "/unit" })
  .use(authMacro)
  .patch(
    "/:unitId/translations/:lang/source",
    async ({ params, body, identity }): Promise<TranslationSourceResponse> => {
      try {
        return await setTranslationSource(
          identity,
          params.unitId,
          params.lang,
          body.sourceUnitId,
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
      params: workTranslationPathParamsSchema,
      body: translationSourceBodySchema,
      response: translationSourceResponseSchema,
      detail: {
        summary: "Set or clear the translation source for a unit",
        description:
          "PATCH /unit/:unitId/translations/:lang/source - sets UnitTranslation.sourceUnitId for the given unit and language. Existing translation fields are not touched.",
        tags: ["Units", "Translations"],
      },
    },
  );

export type TranslationSourceApi = typeof translationSourceApi;
