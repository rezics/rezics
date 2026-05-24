import {
  parseJobCommand,
  safeParseJobCommand,
  type AnyJobCommand,
} from "@rezics/job";
import { Elysia } from "elysia";
import { isAuthorized } from "../auth";
import { enqueueCommand } from "../queue/enqueue";
import type { QueueLike } from "../queue/types";

const MAX_BATCH_SIZE = 100;

export function createEnqueueApi(options: {
  queue: QueueLike;
  internalSecret: string;
}) {
  return new Elysia({ name: "job-runner-enqueue" })
    .post("/jobs/enqueue", async ({ body, headers, set }) => {
      if (!isAuthorized(headers, options.internalSecret)) {
        set.status = 401;
        return { status: "error", message: "Unauthorized" };
      }

      const parsed = safeParseJobCommand(body);
      if (!parsed.success) {
        set.status = 400;
        return { status: "error", message: "Invalid job command" };
      }

      return enqueueCommand(options.queue, parsed.output);
    })
    .post("/jobs/enqueue/batch", async ({ body, headers, set }) => {
      if (!isAuthorized(headers, options.internalSecret)) {
        set.status = 401;
        return { status: "error", message: "Unauthorized" };
      }

      const candidate = body as { commands?: unknown[] };
      if (
        !Array.isArray(candidate.commands) ||
        candidate.commands.length > MAX_BATCH_SIZE
      ) {
        set.status = 400;
        return {
          status: "error",
          message: `Expected 1-${MAX_BATCH_SIZE} commands`,
        };
      }

      const commands: AnyJobCommand[] = [];
      for (const command of candidate.commands) {
        try {
          commands.push(parseJobCommand(command));
        } catch {
          set.status = 400;
          return { status: "error", message: "Invalid job command in batch" };
        }
      }

      return {
        results: await Promise.all(
          commands.map((command) => enqueueCommand(options.queue, command)),
        ),
      };
    });
}
