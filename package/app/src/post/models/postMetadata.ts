export type TimestampInput = string | Date | null | undefined;

function timeValue(value: TimestampInput): number | null {
  if (!value) return null;
  const time =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isEditedTimestamp(
  createdAt: TimestampInput,
  updatedAt: TimestampInput,
): boolean {
  const created = timeValue(createdAt);
  const updated = timeValue(updatedAt);
  if (created === null || updated === null) return false;
  return created !== updated;
}
