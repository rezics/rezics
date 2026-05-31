import type {
  TranslationSourceBody,
  TranslationSourceResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const translationSourceApi = {
  /**
   * `PATCH /unit/:unitId/translations/:lang/source` - set or clear the
   * source pointer for a (unitId, lang) pair.
   */
  patch: async (
    unitId: string,
    lang: string,
    body: TranslationSourceBody,
  ): Promise<TranslationSourceResponse> => {
    return apiFetch<TranslationSourceResponse>(
      `/unit/${unitId}/translations/${lang}/source`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
  },
};
