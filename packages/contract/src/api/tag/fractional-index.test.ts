import { describe, expect, test } from "bun:test";
import {
  generateKeyBetween,
  positionForNewBottomPin,
} from "./fractional-index";

describe("fractional-index compatibility exports", () => {
  test("keeps historical tag imports wired to contract ownership", () => {
    expect(generateKeyBetween("A", "C")).toBe("B");
    expect(positionForNewBottomPin("M") > "M").toBe(true);
  });
});
