import { JOB_LANE_VALUES, JOB_LANES, type JobLane } from "@rezics/job";

/**
 * Which job lanes a worker process consumes.
 *
 * - `all`: every lane (single-worker deployments / local dev).
 * - `default`: every lane except `ranking`; this is the `job-runner-worker`
 *   role, so sync/search/history/maintenance lanes are never starved by a
 *   ranking recompute burst.
 * - `ranking`: only the `ranking` lane; this is the dedicated `ranking-worker`
 *   role, scaled independently from `job-runner-worker`.
 */
export type WorkerLaneSelection = "all" | "default" | "ranking";

const RANKING_LANES: readonly JobLane[] = [JOB_LANES.ranking];

const DEFAULT_LANES: readonly JobLane[] = JOB_LANE_VALUES.filter(
  (lane) => lane !== JOB_LANES.ranking,
);

/** Resolve the concrete lane set a worker should subscribe to. */
export function resolveWorkerLanes(
  selection: WorkerLaneSelection,
): readonly JobLane[] {
  switch (selection) {
    case "ranking":
      return RANKING_LANES;
    case "default":
      return DEFAULT_LANES;
    default:
      return JOB_LANE_VALUES;
  }
}
