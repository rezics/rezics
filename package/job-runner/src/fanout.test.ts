import { describe, expect, test } from "bun:test";
import {
  fanoutCursorFromPayload,
  nextFanoutPayload,
  shouldContinueFanout,
} from "./fanout";

describe("fanout continuation helpers", () => {
  test("does not continue when a segment returns fewer rows than the limit", () => {
    const payload = { targetId: "unit-1", limit: 3 };
    const result = { processed: 2 };

    expect(shouldContinueFanout(result)).toBe(false);
    expect(nextFanoutPayload(payload, result)).toBeUndefined();
  });

  test("does not continue when a segment exactly fills the limit without a next cursor", () => {
    const payload = { targetId: "unit-1", limit: 3 };
    const result = { processed: 3 };

    expect(shouldContinueFanout(result)).toBe(false);
    expect(nextFanoutPayload(payload, result)).toBeUndefined();
  });

  test("continues from the returned cursor when a segment has more rows", () => {
    const payload = { targetId: "unit-1", cursor: "post-1", limit: 3 };
    const result = { processed: 3, nextCursor: "post-4" };

    expect(shouldContinueFanout(result)).toBe(true);
    expect(nextFanoutPayload(payload, result)).toEqual({
      targetId: "unit-1",
      cursor: "post-4",
      limit: 3,
    });
  });

  test("keeps the same cursor for retries before a segment reports success", () => {
    const payload = { targetId: "unit-1", cursor: "post-1", limit: 3 };

    expect(fanoutCursorFromPayload(payload)).toEqual({
      cursor: "post-1",
      limit: 3,
    });
  });
});
