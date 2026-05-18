import { describe, expect, test } from "bun:test";
import type { PostExtra } from "@rezics/contract";
import { PostKind } from "../generated/client.js";
import { generatePostExtra } from "./generators";

describe("generatePostExtra", () => {
  test("generates contract-valid excerpt source metadata", () => {
    const extra = generatePostExtra(PostKind.EXCERPT) as PostExtra | null;

    expect(extra).not.toBeNull();
    expect(extra?.source).toEqual({
      mode: "url",
      url: expect.any(String),
      title: expect.any(String),
    });
    expect(extra?.source?.title.length).toBeGreaterThan(0);
    expect(extra?.source?.title.length).toBeLessThanOrEqual(200);
  });
});
