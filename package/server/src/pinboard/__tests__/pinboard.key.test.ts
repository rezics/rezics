import { describe, expect, test } from "bun:test";
import { PINBOARD_KEYS } from "@rezics/contract";
import { assertPinboardKey } from "../pinboard.service";

describe("assertPinboardKey", () => {
  test("accepts whitelisted keys", () => {
    for (const k of PINBOARD_KEYS) {
      expect(() => assertPinboardKey(k)).not.toThrow();
    }
  });

  test("rejects unknown keys with 400", () => {
    expect(() => assertPinboardKey("home_notice")).toThrow();
  });
});

describe("PINBOARD_KEYS contract", () => {
  test("is exactly announcement + pinned", () => {
    expect([...PINBOARD_KEYS]).toEqual(["announcement", "pinned"]);
  });
});
