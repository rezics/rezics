import type {
  ResolvedWorkRealmContext,
  WorkRealmContextDTO,
  WorkRealmContextListResponse,
} from "@rezics/contract";
import {
  createWorkRealmContextSchema,
  listWorkRealmContextQuerySchema,
  resolvedWorkRealmContextSchema,
  resolveWorkRealmContextQuerySchema,
  updateWorkRealmContextSchema,
  workRealmContextDTOSchema,
  workRealmContextListResponseSchema,
  workRealmContextPathParamsSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { AppError } from "@/utils/errors";
import { mapWorkRealmContextToDTO } from "./mapper";
import { workRealmContextService } from "./service";

async function requireContextManager(identity: any) {
  if (isAdminRole(identity) || (await verifyAdminFromDb(identity.userId))) {
    return;
  }
  throw new AppError(403, "Forbidden: work realm context management required", {
    code: "WORK_REALM_CONTEXT_FORBIDDEN",
  });
}

export const workRealmContextApi = new Elysia({
  prefix: "/work-realm-context",
})
  .use(authMacro)
  .get(
    "/list",
    async ({ query }): Promise<WorkRealmContextListResponse> => {
      const rows = await workRealmContextService.list(query);
      return { contexts: rows.map(mapWorkRealmContextToDTO) };
    },
    {
      query: listWorkRealmContextQuerySchema,
      response: { 200: workRealmContextListResponseSchema },
      detail: {
        summary: "List work realm contexts",
        tags: ["WorkRealmContext"],
      },
    },
  )
  .get(
    "/resolve",
    async ({ query }): Promise<ResolvedWorkRealmContext> =>
      workRealmContextService.resolveForRelease(query),
    {
      query: resolveWorkRealmContextQuerySchema,
      response: { 200: resolvedWorkRealmContextSchema },
      detail: {
        summary: "Resolve release wiki realm context",
        tags: ["WorkRealmContext"],
      },
    },
  )
  .get(
    "/:contextId",
    async ({ params }): Promise<WorkRealmContextDTO> => {
      const row = await workRealmContextService.getById(params.contextId);
      if (!row) {
        throw new AppError(404, "WorkRealmContext not found");
      }
      return mapWorkRealmContextToDTO(row);
    },
    {
      params: workRealmContextPathParamsSchema,
      response: { 200: workRealmContextDTOSchema },
      detail: {
        summary: "Get work realm context",
        tags: ["WorkRealmContext"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<WorkRealmContextDTO> => {
      await requireContextManager(identity);
      const row = await workRealmContextService.create(body, identity.userId);
      return mapWorkRealmContextToDTO(row);
    },
    {
      requireLogin: true,
      body: createWorkRealmContextSchema,
      response: { 200: workRealmContextDTOSchema },
      detail: {
        summary: "Create work realm context",
        tags: ["WorkRealmContext"],
      },
    },
  )
  .patch(
    "/:contextId",
    async ({ params, body, identity }): Promise<WorkRealmContextDTO> => {
      await requireContextManager(identity);
      const row = await workRealmContextService.update(
        params.contextId,
        body,
        identity.userId,
      );
      return mapWorkRealmContextToDTO(row);
    },
    {
      requireLogin: true,
      params: workRealmContextPathParamsSchema,
      body: updateWorkRealmContextSchema,
      response: { 200: workRealmContextDTOSchema },
      detail: {
        summary: "Update work realm context",
        tags: ["WorkRealmContext"],
      },
    },
  )
  .delete(
    "/:contextId",
    async ({ params, identity }): Promise<{ message: string }> => {
      await requireContextManager(identity);
      await workRealmContextService.delete(params.contextId);
      return { message: "WorkRealmContext deleted" };
    },
    {
      requireLogin: true,
      params: workRealmContextPathParamsSchema,
      response: { 200: t.Object({ message: t.String() }) },
      detail: {
        summary: "Delete work realm context",
        tags: ["WorkRealmContext"],
      },
    },
  );

export type WorkRealmContextApi = typeof workRealmContextApi;
