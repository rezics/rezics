import type {
  TranslationSourceBody,
  TranslationSourceResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const translationSourceApi = {
  /**
   * `PATCH /unit/:workId/translations/:lang/source` — set or clear the
   * curatorial source-release pointer for a (workId, lang) pair.
   */
  patch: async (
    workId: string,
    lang: string,
    body: TranslationSourceBody,
  ): Promise<TranslationSourceResponse> => {
    return apiFetch<TranslationSourceResponse>(
      `/unit/${workId}/translations/${lang}/source`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
  },
};
