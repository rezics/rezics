export const DEFAULT_FANOUT_SEGMENT_LIMIT = 5000;

export interface FanoutCursor {
  cursor?: string;
  segment?: number;
  limit: number;
}

export function nextFanoutCursor(
  current: FanoutCursor,
  cursor: string | undefined,
): FanoutCursor | undefined {
  if (!cursor) return undefined;
  return {
    cursor,
    segment: (current.segment ?? 0) + 1,
    limit: current.limit,
  };
}
