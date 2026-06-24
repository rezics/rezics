import { JOB_LANE_VALUES, JOB_LANES, type JobLane } from "@rezics/job";

/**
 * Which job lanes a worker process consumes.
 * worker 进程消费哪些 job 通道（lane）。
 *
 * - `all`: every lane (single-worker deployments / local dev).
 * - `all`：所有通道（单 worker 部署 / 本地开发）。
 * - `default`: every lane except `ranking`; this is the `job-runner-worker`
 *   role, so sync/search/history/maintenance lanes are never starved by a
 *   ranking recompute burst.
 * - `default`：除 `ranking` 外的所有通道；这是 `job-runner-worker` 角色，
 *   因此 sync/search/history/maintenance 通道不会被 ranking 的重算高峰饿死。
 * - `ranking`: only the `ranking` lane; this is the dedicated `ranking-worker`
 *   role, scaled independently from `job-runner-worker`.
 * - `ranking`：仅 `ranking` 通道；这是专用的 `ranking-worker` 角色，
 *   与 `job-runner-worker` 独立伸缩。
 */
export type WorkerLaneSelection = "all" | "default" | "ranking";

const RANKING_LANES: readonly JobLane[] = [JOB_LANES.ranking];

const DEFAULT_LANES: readonly JobLane[] = JOB_LANE_VALUES.filter(
  (lane) => lane !== JOB_LANES.ranking,
);

/** Resolve the concrete lane set a worker should subscribe to. 解析 worker 应订阅的具体通道集合。 */
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
