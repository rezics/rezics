import type {
  AttachTranslationInput,
  AttachTranslationResponse,
  BestLanguageWikiPostsRequest,
  BestLanguageWikiPostsResponse,
  TranslationGroupSiblingsResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const translationGroupApi = {
  listSiblings: (unitId: string): Promise<TranslationGroupSiblingsResponse> =>
    apiFetch<TranslationGroupSiblingsResponse>(`/unit/${unitId}/translations`),

  attach: (
    unitId: string,
    input: AttachTranslationInput,
  ): Promise<AttachTranslationResponse> =>
    apiFetch<AttachTranslationResponse>(`/unit/${unitId}/translations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  detach: (unitId: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/unit/${unitId}/translation-group`, {
      method: "DELETE",
    }),

  bestLanguageWikiPosts: (
    input: BestLanguageWikiPostsRequest,
  ): Promise<BestLanguageWikiPostsResponse> =>
    apiFetch<BestLanguageWikiPostsResponse>(
      "/translation-group/wiki-posts/best",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    ),
};
