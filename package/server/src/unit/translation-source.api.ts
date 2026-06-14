import {
  contentLanguageSchema,
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
// 参数名 `unitId` 与 `unitApi` 的一致 —— memoirist 要求同一 trie 位置上的参数名必须保持一致。
const workTranslationPathParamsSchema = t.Object({
  unitId: t.String(),
  lang: contentLanguageSchema,
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
