export interface HistoryOutboxStartupEnv {
  HISTORY_QUEUE_INGESTION_ENABLED?: string;
  HISTORY_OUTBOX_POLLER_FALLBACK?: string;
}

function isTruthyFlag(value: string | undefined) {
  return value === "1" || value === "true";
}

export function shouldStartHistoryOutboxPoller(
  env: HistoryOutboxStartupEnv,
): boolean {
  const queueIngestionEnabled =
    env.HISTORY_QUEUE_INGESTION_ENABLED === undefined ||
    env.HISTORY_QUEUE_INGESTION_ENABLED === "true" ||
    env.HISTORY_QUEUE_INGESTION_ENABLED === "1";

  if (queueIngestionEnabled) {
    return isTruthyFlag(env.HISTORY_OUTBOX_POLLER_FALLBACK);
  }

  return isTruthyFlag(env.HISTORY_OUTBOX_POLLER_FALLBACK);
}
