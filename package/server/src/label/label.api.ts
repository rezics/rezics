import {
  createLabelInputSchema,
  labelListQuerySchema,
  parseIdsCsv,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { mapLabelToDTO } from "./label.mapper";
import { labelService } from "./label.service";

export const labelApi = new Elysia({ prefix: "/label" })
  .use(authMacro)

  .get(
    "/list",
    async ({ query }) => {
      const ids = parseIdsCsv(query.ids) ?? [];
      const labels = await labelService.getByUnitIds(ids);
      return { labels: labels.map(mapLabelToDTO) };
    },
    {
      query: labelListQuerySchema,
      detail: {
        summary: "List LABEL units",
        description: "Hydrate curated short labels by Unit ids",
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
