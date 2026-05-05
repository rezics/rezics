import {
  type AttachTranslationResponse,
  attachTranslationResponseSchema,
  attachTranslationSchema,
  type TranslationGroupSiblingsResponse,
  translationGroupParamsSchema,
  translationGroupSiblingsSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { translationGroupService } from "./translation-group.service";

export const translationGroupApi = new Elysia({ prefix: "/translation-group" })
  .use(authMacro)
  .get(
    "/:unitId/translations",
    async ({ params }): Promise<TranslationGroupSiblingsResponse> => {
      const result = await translationGroupService.listGroupSiblings(
        params.unitId,
      );
      return result as TranslationGroupSiblingsResponse;
    },
    {
      params: translationGroupParamsSchema,
      response: translationGroupSiblingsSchema,
      detail: {
        summary: "List translation siblings",
        description:
          "Return parallel-translation sibling Units of the given POST and the group's supportedLanguages. If the unit has no group, returns an empty result with groupId = null.",
        tags: ["TranslationGroup"],
      },
    },
  )
  .post(
    "/:unitId/translations",
    async ({ params, body, identity }): Promise<AttachTranslationResponse> => {
      return translationGroupService.attachTranslation(
        params.unitId,
        body,
        identity.userId,
      );
    },
    {
      requireLogin: true,
      params: translationGroupParamsSchema,
      body: attachTranslationSchema,
      response: attachTranslationResponseSchema,
      detail: {
        summary: "Attach translation",
        description:
          "Create a new POST translation linked to the existing POST. Lazily creates the TranslationGroup on the first attach.",
        tags: ["TranslationGroup"],
      },
    },
  )
  .delete(
    "/:unitId/translation-group",
    async ({ params }): Promise<{ message: string }> => {
      await translationGroupService.detachTranslation(params.unitId);
      return { message: "Detached from translation group" };
    },
    {
      requireLogin: true,
      params: translationGroupParamsSchema,
      detail: {
        summary: "Detach translation",
        description:
          "Detach the unit from its translation group. Removes the group entirely if the unit was the last member.",
        tags: ["TranslationGroup"],
      },
    },
  );
