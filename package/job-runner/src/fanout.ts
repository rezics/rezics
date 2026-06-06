export const DEFAULT_FANOUT_SEGMENT_LIMIT = 5000;

export interface FanoutCursor {
  cursor?: string;
  segment?: number;
  limit: number;
}

export interface SegmentResult {
  processed: number;
  nextCursor?: string;
}

export interface FanoutPayload {
  targetId: string;
  cursor?: string;
  limit?: number;
}

export function fanoutCursorFromPayload(payload: FanoutPayload): FanoutCursor {
  return {
    cursor: payload.cursor,
    limit: payload.limit ?? DEFAULT_FANOUT_SEGMENT_LIMIT,
  };
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

export function shouldContinueFanout(result: SegmentResult): boolean {
  return Boolean(result.nextCursor);
}

export function nextFanoutPayload(
  payload: FanoutPayload,
  result: SegmentResult,
): FanoutPayload | undefined {
  const next = nextFanoutCursor(
    fanoutCursorFromPayload(payload),
    result.nextCursor,
  );
  if (!next) return undefined;
  return {
    targetId: payload.targetId,
    cursor: next.cursor,
    limit: next.limit,
  };
}
