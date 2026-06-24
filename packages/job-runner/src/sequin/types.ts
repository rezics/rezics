export interface SequinMessage {
  idempotencyKey?: string;
  table: string;
  action: string;
  record: Record<string, unknown>;
  changes?: Record<string, unknown>;
  recordPks: Record<string, string | number>;
  commitLsn?: string;
  commitIdx?: number;
  commitTimestamp?: string;
}
