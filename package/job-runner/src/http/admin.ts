import { Elysia } from "elysia";
import { isAuthorized } from "../auth";
import { JOB_LANE_VALUES } from "@rezics/job";

export interface AdminQueueLike {
  getQueueSize?: (name: string) => Promise<number>;
  fetch?: (name: string, options?: unknown) => Promise<unknown[]>;
  retry?: (name: string, id: string) => Promise<unknown>;
  cancel?: (name: string, id: string) => Promise<unknown>;
}

export function createAdminApi(options: {
  queue: AdminQueueLike;
  internalSecret: string;
}) {
  return new Elysia({ name: "job-runner-admin" })
    .derive(({ headers, set }) => {
      if (!isAuthorized(headers, options.internalSecret)) {
        set.status = 401;
        return { authorized: false };
      }
      return { authorized: true };
    })
    .get("/admin/queues/counts", async ({ authorized }) => {
      if (!authorized) return { status: "error", message: "Unauthorized" };
      const counts = await Promise.all(
        JOB_LANE_VALUES.map(async (lane) => ({
          lane,
          pending: options.queue.getQueueSize
            ? await options.queue.getQueueSize(lane)
            : null,
        })),
      );
      return { counts };
    })
    .get("/admin/jobs/failed", ({ authorized }) => {
      if (!authorized) return { status: "error", message: "Unauthorized" };
      return { jobs: [] };
    })
    .get("/admin/jobs/failed/:lane/:id", ({ authorized, params }) => {
      if (!authorized) return { status: "error", message: "Unauthorized" };
      return { lane: params.lane, id: params.id, job: null };
    })
    .post(
      "/admin/jobs/failed/:lane/:id/retry",
      async ({ authorized, params }) => {
        if (!authorized) return { status: "error", message: "Unauthorized" };
        await options.queue.retry?.(params.lane, params.id);
        return { status: "ok", lane: params.lane, id: params.id };
      },
    )
    .post(
      "/admin/jobs/failed/:lane/:id/discard",
      async ({ authorized, params }) => {
        if (!authorized) return { status: "error", message: "Unauthorized" };
        await options.queue.cancel?.(params.lane, params.id);
        return { status: "ok", lane: params.lane, id: params.id };
      },
    );
}
