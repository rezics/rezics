import { type AnyJobCommand, JOB_LANES, type JobLane } from "@rezics/job";
import type { QueueSendOptions } from "./types";

const DEAD_LETTER_SUFFIX = ".dead";

export const LANE_POLICIES: Record<JobLane, QueueSendOptions> = {
  [JOB_LANES.searchSyncFast]: {
    retryLimit: 5,
    retryDelay: 30,
    expireInSeconds: 10 * 60,
    retentionSeconds: 7 * 24 * 60 * 60,
    deadLetter: `${JOB_LANES.searchSyncFast}${DEAD_LETTER_SUFFIX}`,
  },
  [JOB_LANES.searchSyncSlow]: {
    retryLimit: 5,
    retryDelay: 60,
    expireInSeconds: 30 * 60,
    retentionSeconds: 7 * 24 * 60 * 60,
    deadLetter: `${JOB_LANES.searchSyncSlow}${DEAD_LETTER_SUFFIX}`,
    policy: "short",
    singletonSeconds: 5 * 60,
  },
  [JOB_LANES.historyIngest]: {
    retryLimit: 10,
    retryDelay: 30,
    expireInSeconds: 15 * 60,
    retentionSeconds: 30 * 24 * 60 * 60,
    deadLetter: `${JOB_LANES.historyIngest}${DEAD_LETTER_SUFFIX}`,
  },
  [JOB_LANES.maintenance]: {
    retryLimit: 3,
    retryDelay: 2 * 60,
    expireInSeconds: 2 * 60 * 60,
    retentionSeconds: 30 * 24 * 60 * 60,
    deadLetter: `${JOB_LANES.maintenance}${DEAD_LETTER_SUFFIX}`,
  },
};

export function queueOptionsForCommand(
  command: AnyJobCommand,
): QueueSendOptions {
  const base = LANE_POLICIES[command.lane];
  if (!base)
    throw new Error(`No queue policy configured for lane ${command.lane}`);
  if (command.lane !== JOB_LANES.searchSyncSlow) return base;

  return {
    ...base,
    singletonKey: command.idempotencyKey,
    startAfter: new Date(Date.now() + 1500),
  };
}
