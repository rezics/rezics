import {
  type AnyJobCommand,
  JOB_LANE_VALUES,
  type JobLane,
  parseJobCommand,
} from "@rezics/job";
import { enqueueCommand } from "./queue/enqueue";
import type { WorkerQueueLike } from "./queue/types";

export interface HandlerContext {
  enqueue(command: AnyJobCommand): Promise<unknown>;
}

export type JobHandler = (
  command: AnyJobCommand,
  context: HandlerContext,
) => Promise<unknown>;

type WorkerJob = { id: string; data: AnyJobCommand };

export function createUnknownCommandError(command: AnyJobCommand) {
  return new Error(
    `No job handler registered for command kind: ${command.kind}`,
  );
}

export async function registerWorkers(
  queue: WorkerQueueLike,
  handlers: Partial<Record<AnyJobCommand["kind"], JobHandler>>,
  lanes: readonly JobLane[] = JOB_LANE_VALUES,
) {
  for (const lane of lanes) {
    await queue.work(lane, async (jobOrJobs) => {
      const jobs = Array.isArray(jobOrJobs) ? jobOrJobs : [jobOrJobs];
      return Promise.all(jobs.map((job) => processJob(queue, handlers, job)));
    });
  }
}

async function processJob(
  queue: WorkerQueueLike,
  handlers: Partial<Record<AnyJobCommand["kind"], JobHandler>>,
  job: WorkerJob,
) {
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
      enqueue: (nextCommand) => enqueueCommand(queue, nextCommand),
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
}
