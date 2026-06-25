import type { AnyJobCommand, EnqueueResult, JobLane } from "@rezics/contract/job";
import { queueOptionsForCommand } from "./policy";
import type { QueueLike } from "./types";

function normalizeJobId(jobId: string | null | { id?: string | null }) {
  if (typeof jobId === "string" || jobId === null) return jobId;
  return jobId.id ?? null;
}

export function normalizeEnqueueResult(
  command: Pick<AnyJobCommand, "kind" | "idempotencyKey" | "lane">,
  jobId: string | null | { id?: string | null },
): EnqueueResult {
  const normalizedJobId = normalizeJobId(jobId);
  return {
    kind: command.kind,
    idempotencyKey: command.idempotencyKey,
    lane: command.lane,
    status: normalizedJobId === null ? "coalesced" : "created",
    ...(normalizedJobId ? { jobId: normalizedJobId } : {}),
  };
}

export async function enqueueCommand(
  queue: QueueLike,
  command: AnyJobCommand,
): Promise<EnqueueResult> {
  const jobId = await queue.send(
    command.lane as JobLane,
    command,
    queueOptionsForCommand(command),
  );
  return normalizeEnqueueResult(command, jobId);
}
