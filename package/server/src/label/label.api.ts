import { createLabelInputSchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { mapLabelToDTO } from "./label.mapper";
import { labelService } from "./label.service";

export const labelApi = new Elysia({ prefix: "/label" })
  .use(authMacro)

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
