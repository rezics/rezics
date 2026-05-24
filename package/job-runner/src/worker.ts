import {
  JOB_LANE_VALUES,
  parseJobCommand,
  type AnyJobCommand,
} from "@rezics/job";
import type { WorkerQueueLike } from "./queue/types";

export interface HandlerContext {
  enqueue(command: AnyJobCommand): Promise<unknown>;
}

export type JobHandler = (
  command: AnyJobCommand,
  context: HandlerContext,
) => Promise<unknown>;

export function createUnknownCommandError(command: AnyJobCommand) {
  return new Error(
    `No job handler registered for command kind: ${command.kind}`,
  );
}

export async function registerWorkers(
  queue: WorkerQueueLike,
  handlers: Partial<Record<AnyJobCommand["kind"], JobHandler>>,
) {
  for (const lane of JOB_LANE_VALUES) {
    await queue.work(lane, async (job) => {
      const command = parseJobCommand(job.data);
      console.log("[job-runner] job start", {
        jobId: job.id,
        kind: command.kind,
        lane: command.lane,
        idempotencyKey: command.idempotencyKey,
        source: command.source,
        tags: command.tags,
      });

      const handler = handlers[command.kind];
      if (!handler) throw createUnknownCommandError(command);

      try {
        const output = await handler(command, {
          enqueue: (nextCommand) => queue.send(nextCommand.lane, nextCommand),
        });
        console.log("[job-runner] job success", {
          jobId: job.id,
          kind: command.kind,
          idempotencyKey: command.idempotencyKey,
          output,
        });
        return output;
      } catch (error) {
        console.error("[job-runner] job failure", {
          jobId: job.id,
          kind: command.kind,
          idempotencyKey: command.idempotencyKey,
          error,
        });
        throw error;
      }
    });
  }
}
