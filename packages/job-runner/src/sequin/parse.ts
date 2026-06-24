import type { SequinMessage } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function primaryKeysFrom(
  raw: Record<string, unknown>,
  record: Record<string, unknown>,
) {
  const explicit = asRecord(raw.record_pks ?? raw.recordPks ?? raw.primary_key);
  if (Object.keys(explicit).length > 0) {
    return explicit as Record<string, string | number>;
  }
  const id = record.id;
  return typeof id === "string" || typeof id === "number" ? { id } : {};
}

function normalizeOne(input: unknown): SequinMessage | null {
  const raw = asRecord(input);
  const data = asRecord(raw.data);
  const metadata = asRecord(raw.metadata);
  const record = asRecord(raw.record ?? data.record ?? raw.row);
  const table = stringValue(raw.table ?? data.table ?? metadata.table_name);
  const action = stringValue(raw.action ?? data.action ?? metadata.action);
  if (!table || !action) return null;

  return {
    idempotencyKey: stringValue(
      raw.idempotency_key ?? raw.idempotencyKey ?? data.idempotency_key,
    ),
    table,
    action,
    record,
    changes: asRecord(raw.changes ?? data.changes),
    recordPks: primaryKeysFrom(raw, record),
    commitLsn: stringValue(
      raw.commit_lsn ?? raw.commitLsn ?? metadata.commit_lsn,
    ),
    commitIdx: numberValue(
      raw.commit_idx ?? raw.commitIdx ?? metadata.commit_idx,
    ),
    commitTimestamp: stringValue(
      raw.commit_timestamp ?? raw.commitTimestamp ?? metadata.commit_timestamp,
    ),
  };
}

export function parseSequinPayload(payload: unknown): SequinMessage[] {
  const raw = asRecord(payload);
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(raw.messages)
      ? raw.messages
      : Array.isArray(raw.data)
        ? raw.data
        : [payload];

  return candidates
    .map((candidate) => normalizeOne(candidate))
    .filter((message): message is SequinMessage => message !== null);
}
