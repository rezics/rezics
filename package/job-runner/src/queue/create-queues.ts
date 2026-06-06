import { JOB_LANE_VALUES, JOB_LANES, type JobLane } from "@rezics/job";
import { LANE_POLICIES } from "./policy";
import type { QueueLike } from "./types";

export const DEAD_LETTER_LANES = JOB_LANE_VALUES.map((lane) => `${lane}.dead`);

export async function createQueues(queue: QueueLike) {
  for (const lane of DEAD_LETTER_LANES) {
    await queue.createQueue(lane);
  }

  for (const lane of JOB_LANE_VALUES) {
    const policy = LANE_POLICIES[lane as JobLane];

    await queue.createQueue(lane, policy);
    await queue.updateQueue?.(lane, policy);
  }

  return {
    lanes: JOB_LANE_VALUES,
    deadLetterLanes: DEAD_LETTER_LANES,
    slowLanePolicy: LANE_POLICIES[JOB_LANES.searchSyncSlow],
  };
}
