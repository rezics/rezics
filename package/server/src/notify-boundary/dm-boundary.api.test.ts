import { describe, expect, test } from "bun:test";
import { subscriptionPermitsDm } from "./dm-boundary.subscription";

/**
 * Unit tests for the DM permission predicate. A Subscription's
 * `channels` permits DM iff it contains the global wildcard, the DM
 * category wildcard, or the exact event.
 * Mutual subscription is NOT required — one-way (sender→recipient) is
 * sufficient, matching the previous one-way Follow semantics.
 */
describe("subscriptionPermitsDm", () => {
  test("global wildcard permits DM", () => {
    expect(subscriptionPermitsDm(["*"])).toBe(true);
  });

  test("category wildcard 'dm.*' permits DM", () => {
    expect(subscriptionPermitsDm(["dm.*"])).toBe(true);
  });

  test("exact 'dm.message' channel permits DM", () => {
    expect(subscriptionPermitsDm(["dm.message"])).toBe(true);
  });

  test("non-DM channels do NOT permit DM", () => {
    expect(subscriptionPermitsDm(["post.new"])).toBe(false);
    expect(subscriptionPermitsDm(["post.*"])).toBe(false);
    expect(subscriptionPermitsDm(["review.new"])).toBe(false);
  });

  test("mixed channels with at least one DM channel permits DM", () => {
    expect(subscriptionPermitsDm(["post.new", "dm.message"])).toBe(true);
    expect(subscriptionPermitsDm(["review.new", "dm.*"])).toBe(true);
  });

  test("empty channels does not permit DM", () => {
    expect(subscriptionPermitsDm([])).toBe(false);
  });
});
