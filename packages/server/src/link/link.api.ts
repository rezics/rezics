import type { LinkDTO } from "@rezics/contract";
import { createLinkSchema, updateLinkSchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { linkService } from "./link.service";

export const linkApi = new Elysia({ prefix: "/link" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity }): Promise<LinkDTO> => {
      return linkService.create(body, identity.userId);
    },
    {
      requireLogin: true,
      body: createLinkSchema,
      detail: {
        summary: "Create link",
        description: "Create a new LINK unit with URL and metadata",
        tags: ["Links"],
      },
    },
  )
  .get(
    "/:unitId",
    async ({ params }): Promise<LinkDTO> => {
      return linkService.getByUnitId(params.unitId);
    },
    {
      params: t.Object({ unitId: t.String() }),
      detail: {
        summary: "Get link",
        description: "Get a link unit by ID",
        tags: ["Links"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body }): Promise<LinkDTO> => {
      return linkService.update(params.unitId, body);
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      body: updateLinkSchema,
      detail: {
        summary: "Update link",
        description: "Update a link unit",
        tags: ["Links"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params }): Promise<{ message: string }> => {
      await linkService.delete(params.unitId);
      return { message: "Link deleted successfully" };
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String() }),
      detail: {
        summary: "Delete link",
        description: "Delete a link unit",
        tags: ["Links"],
      },
    },
  );

export default linkApi;
