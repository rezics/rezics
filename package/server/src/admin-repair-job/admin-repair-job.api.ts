import type { AdminRepairJob, AdminRepairJobDryRun } from "@rezics/contract";
import {
  adminRepairJobDryRunRequestSchema,
  adminRepairJobDryRunSchema,
  adminRepairJobOperationRequestSchema,
  adminRepairJobOperationResponseSchema,
  adminRepairJobSchema,
  adminRepairJobStartRequestSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { governanceRoutePolicyService, sitePolicyActions } from "@/governance";
import { authMacro } from "@/middleware";
import { adminRepairJobService } from "./admin-repair-job.service";

async function assertRepairPolicy(input: { identity: any; status: any }) {
  const decision = await governanceRoutePolicyService.decideForIdentity({
    identity: input.identity,
    action: sitePolicyActions.repairRun,
    target: {
      kind: "admin-repair-job",
      id: "global",
    },
  });
  if (!decision.allowed) {
    return input.status(
      403,
      decision.safeMessage ?? "Forbidden: policy denied this repair action",
    );
  }
}

export const adminRepairJobApi = new Elysia({ prefix: "/admin/repair-job" })
  .use(authMacro)
  .post(
    "/dry-run",
    async ({
      body,
      identity,
      status,
    }): Promise<AdminRepairJobDryRun | string> => {
      const denied = await assertRepairPolicy({ identity, status });
      if (denied) return denied;
      return adminRepairJobService.dryRun({
        ...body,
        actorUserId: identity.userId,
      });
    },
    {
      requireLogin: true,
      body: adminRepairJobDryRunRequestSchema,
      response: {
        200: adminRepairJobDryRunSchema,
        403: t.String(),
      },
      detail: {
        summary: "Dry-run an admin repair job",
        tags: ["Admin", "Repair"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity, status }): Promise<AdminRepairJob | string> => {
      const denied = await assertRepairPolicy({ identity, status });
      if (denied) return denied;
      return adminRepairJobService.start({
        ...body,
        actorUserId: identity.userId,
      });
    },
    {
      requireLogin: true,
      body: adminRepairJobStartRequestSchema,
      response: {
        200: adminRepairJobSchema,
        403: t.String(),
      },
      detail: {
        summary: "Start an admin repair job",
        tags: ["Admin", "Repair"],
      },
    },
  )
  .post(
    "/operation/retry",
    async ({ body, identity, status }) => {
      const denied = await assertRepairPolicy({ identity, status });
      if (denied) return denied;
      return adminRepairJobService.retryOperation({
        ...body,
        actorUserId: identity.userId,
      });
    },
    {
      requireLogin: true,
      body: adminRepairJobOperationRequestSchema,
      response: {
        200: adminRepairJobOperationResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Retry a repair job-runner operation",
        tags: ["Admin", "Repair"],
      },
    },
  )
  .post(
    "/operation/cancel",
    async ({ body, identity, status }) => {
      const denied = await assertRepairPolicy({ identity, status });
      if (denied) return denied;
      return adminRepairJobService.cancelOperation({
        ...body,
        actorUserId: identity.userId,
      });
    },
    {
      requireLogin: true,
      body: adminRepairJobOperationRequestSchema,
      response: {
        200: adminRepairJobOperationResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "Cancel a repair job-runner operation",
        tags: ["Admin", "Repair"],
      },
    },
  );

export type AdminRepairJobApi = typeof adminRepairJobApi;
