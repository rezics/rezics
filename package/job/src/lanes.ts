export const JOB_LANES = {
  searchSyncFast: "search.sync.fast",
  searchSyncSlow: "search.sync.slow",
  historyIngest: "history.ingest",
  maintenance: "maintenance",
} as const;

export const JOB_LANE_VALUES = Object.values(JOB_LANES);

export type JobLane = (typeof JOB_LANES)[keyof typeof JOB_LANES];
