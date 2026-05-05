import { describe, expect, test } from "bun:test";
import { bucketize } from "./progress";

describe("bucketize", () => {
  test("maps progress boundaries into ten fixed buckets", () => {
    expect(bucketize(0)).toBe(0);
    expect(bucketize(0.099999)).toBe(0);
    expect(bucketize(0.1)).toBe(1);
    expect(bucketize(0.5)).toBe(5);
    expect(bucketize(0.9)).toBe(9);
    expect(bucketize(0.999999)).toBe(9);
    expect(bucketize(1)).toBe(9);
  });

  test("maps mid-range values and clamps out-of-range input", () => {
    expect(bucketize(0.27)).toBe(2);
    expect(bucketize(0.34)).toBe(3);
    expect(bucketize(0.76)).toBe(7);
    expect(bucketize(-0.1)).toBe(0);
    expect(bucketize(1.1)).toBe(9);
  });
});
