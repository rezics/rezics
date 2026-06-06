import { describe, expect, test } from "bun:test";
import { shouldRecordShareIntent } from "../models/shareIntent";

describe("shouldRecordShareIntent", () => {
  test("records only authenticated non-pending share intent with a target", () => {
    expect(
      shouldRecordShareIntent({
        actorUserId: "user-1",
        targetId: "unit-1",
        isPending: false,
      }),
    ).toBe(true);
    expect(
      shouldRecordShareIntent({
        actorUserId: null,
        targetId: "unit-1",
        isPending: false,
      }),
    ).toBe(false);
    expect(
      shouldRecordShareIntent({
        actorUserId: "user-1",
        targetId: undefined,
        isPending: false,
      }),
    ).toBe(false);
    expect(
      shouldRecordShareIntent({
        actorUserId: "user-1",
        targetId: "unit-1",
        isPending: true,
      }),
    ).toBe(false);
  });
});
