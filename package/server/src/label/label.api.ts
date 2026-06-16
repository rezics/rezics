import { createLabelInputSchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { mapLabelToDTO } from "./label.mapper";
import { labelService } from "./label.service";

export const labelApi = new Elysia({ prefix: "/label" })
  .use(authMacro)

  .get(
    "/search",
    async ({ query }) => {
      const labels = await labelService.search({
        keyword: query.q,
        limit: query.limit,
      });
      return { items: labels.map(mapLabelToDTO) };
    },
    {
      query: t.Object({
        q: t.String(),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
      }),
      detail: {
        summary: "Search LABEL units by name",
        description:
          "Manage-picker search over LABEL unit translations (any language)",
        tags: ["Labels"],
      },
    },
  )

  .post(
    "/",
    async ({ body, identity }) => {
      const label = await labelService.create({
        userId: identity.userId,
        translations: body.translations,
      });
      return mapLabelToDTO(label);
    },
    {
      requireLogin: true,
      body: createLabelInputSchema,
      detail: {
        summary: "Create LABEL unit",
        description:
          "Create a curated short label with multilingual translations (zone manage quick-create)",
        tags: ["Labels"],
      },
    },
  );

export default labelApi;
