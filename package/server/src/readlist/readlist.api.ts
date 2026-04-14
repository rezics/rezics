import type {
  CreateReadlistInput,
  ReadlistListResponse,
  ReadlistResponse,
} from "@rezics/contract";
import {
  BasicAdminPermission,
  createReadlistSchema,
  hasPermissionToDeleteReadlist,
  hasPermissionToUpdateReadlist,
  readlistListQuerySchema,
  readlistParamsSchema,
  updateReadlistSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { readlistService } from "./readlist.service";

export const readlistApi = new Elysia({ prefix: "/readlists" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<ReadlistResponse> => {
      return readlistService.getByUnitId(params.unitId);
    },
    {
      params: readlistParamsSchema,
      detail: {
        summary: "Get readlist",
        description: "Get a single readlist by unit ID",
        tags: ["Readlists"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<ReadlistResponse> => {
      const req: CreateReadlistInput = {
        title: body.title,
        coverUrl: body.coverUrl,
        book: body.book,
        review: body.review,
        order: body.order,
      };
      return readlistService.create(req, identity.unitId);
    },
    {
      requireLogin: true,
      body: createReadlistSchema,
      detail: {
        summary: "Create readlist",
        description: "Create a new readlist",
        tags: ["Readlists"],
      },
    },
  )
  .get(
    "/",
    async ({ query, identity, set }): Promise<ReadlistListResponse> => {
      if (!BasicAdminPermission(identity)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to get all books",
        );
      }
      const { readlists, total } = await readlistService.list(query as any);
      return { readlists, total };
    },
    {
      requireLogin: true,
      query: readlistListQuerySchema,
      detail: {
        summary: "Get all readlists",
        description: "List readlists with rich filters and pagination",
        tags: ["Readlists"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<ReadlistResponse> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Readlist not found: ${params.unitId}`);
      }
      if (!hasPermissionToUpdateReadlist(identity, target as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this readlist",
        );
      }
      return readlistService.update(params.unitId, body);
    },
    {
      requireLogin: true,
      params: readlistParamsSchema,
      body: updateReadlistSchema,
      detail: {
        summary: "Update readlist",
        description: "Update an existing readlist by unit ID",
        tags: ["Readlists"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!hasPermissionToDeleteReadlist(identity, target as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to delete this readlist",
        );
      }
      await readlistService.delete(params.unitId);
      return { message: "Readlist deleted successfully" };
    },
    {
      requireLogin: true,
      params: readlistParamsSchema,
      detail: {
        summary: "Delete readlist",
        description: "Delete a readlist by unit ID",
        tags: ["Readlists"],
      },
    },
  );

export default readlistApi;
