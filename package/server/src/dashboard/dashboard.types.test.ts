import { describe, expect, test } from "bun:test";
import { notAggregated, section } from "./dashboard.types";

describe("dashboard section wrapper", () => {
  test("wraps a resolved value as { ok }", async () => {
    const result = await section(async () => [1, 2, 3]);
    expect(result).toEqual({ ok: [1, 2, 3] });
  });

  test("wraps a thrown failure as a retryable { error } and isolates it", async () => {
    const result = await section(async () => {
      throw new Error("boom");
    }, "CONTINUE_READING_FAILED");
    expect(result).toEqual({
      error: { code: "CONTINUE_READING_FAILED", retryable: true },
    });
  });

  test("partial failure: one section fails while others succeed", async () => {
    const [a, b] = await Promise.all([
      section(async () => "ok-a"),
      section(async () => {
        throw new Error("b failed");
      }),
    ]);
    expect(a).toEqual({ ok: "ok-a" });
    expect("error" in b && b.error.retryable).toBe(true);
  });

  test("notAggregated marks a non-retryable client-fetched section", () => {
    expect(notAggregated()).toEqual({
      error: { code: "NOT_AGGREGATED", retryable: false },
    });
  });
});
