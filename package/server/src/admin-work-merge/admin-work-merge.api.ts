import type {
  AdminWorkMergeOperation,
  AdminWorkMergePreview,
} from "@rezics/contract";
import {
  adminWorkMergeOperationSchema,
  adminWorkMergeParamsSchema,
  adminWorkMergePreviewSchema,
  adminWorkMergeRequestSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, isAdminRole, verifyAdminFromDb } from "@/middleware";
import { mapAdminWorkMergeOperation } from "./admin-work-merge.mapper";
import { adminWorkMergeService } from "./admin-work-merge.service";

async function assertAdmin(identity: any, status: any) {
  if (!isAdminRole(identity)) {
    return status(403, "Forbidden: Admin role required");
  }
  const isAdmin = await verifyAdminFromDb(identity.userId);
  if (!isAdmin) return status(403, "Forbidden: Admin role required");
}

export const adminWorkMergeApi = new Elysia({ prefix: "/admin/work-merge" })
  .use(authMacro)
  .post(
    "/preview",
    async ({
      body,
      identity,
      status,
    }): Promise<AdminWorkMergePreview | string> => {
      const denied = await assertAdmin(identity, status);
      if (denied) return denied;
      return adminWorkMergeService.preview(body);
    },
    {
      requireLogin: true,
      body: adminWorkMergeRequestSchema,
      response: {
        200: adminWorkMergePreviewSchema,
        403: t.String(),
      },
      detail: {
        summary: "Preview an admin work-domain merge",
        tags: ["Admin", "UnitWork"],
      },
    },
  )
  .post(
    "/",
    async ({
      body,
      identity,
      status,
    }): Promise<AdminWorkMergeOperation | string> => {
      const denied = await assertAdmin(identity, status);
      if (denied) return denied;
      const row = await adminWorkMergeService.start(body, identity.userId);
      return mapAdminWorkMergeOperation(row);
    },
    {
      requireLogin: true,
      body: adminWorkMergeRequestSchema,
      response: {
        200: adminWorkMergeOperationSchema,
        403: t.String(),
      },
      detail: {
        summary: "Start an admin work-domain merge",
        tags: ["Admin", "UnitWork"],
      },
    },
  )
  .get(
    "/:operationId",
    async ({
      params,
      identity,
      status,
    }): Promise<AdminWorkMergeOperation | string> => {
      const denied = await assertAdmin(identity, status);
      if (denied) return denied;
      const row = await adminWorkMergeService.get(params.operationId);
      return mapAdminWorkMergeOperation(row);
    },
    {
      requireLogin: true,
      params: adminWorkMergeParamsSchema,
      response: {
        200: adminWorkMergeOperationSchema,
        403: t.String(),
      },
      detail: {
        summary: "Get admin work-domain merge status",
        tags: ["Admin", "UnitWork"],
      },
    },
  )
  .post(
    "/:operationId/revert",
    async ({
      params,
      identity,
      status,
    }): Promise<AdminWorkMergeOperation | string> => {
      const denied = await assertAdmin(identity, status);
      if (denied) return denied;
      const row = await adminWorkMergeService.revert(
        params.operationId,
        identity.userId,
      );
      return mapAdminWorkMergeOperation(row);
    },
    {
      requireLogin: true,
      params: adminWorkMergeParamsSchema,
      response: {
        200: adminWorkMergeOperationSchema,
        403: t.String(),
      },
      detail: {
        summary: "Revert a completed admin work-domain merge",
        tags: ["Admin", "UnitWork"],
      },
    },
  );

export type AdminWorkMergeApi = typeof adminWorkMergeApi;
