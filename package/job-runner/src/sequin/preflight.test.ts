import { describe, expect, test } from "bun:test";
import { assertSequinHealthAvailable } from "./preflight";

describe("Sequin startup preflight", () => {
  test.each([
    "http",
    "all",
  ] as const)("%s role fails when Sequin is unreachable", async (role) => {
    await expect(
      assertSequinHealthAvailable({
        role,
        healthUrl: "http://127.0.0.1:7376/health",
        fetchImpl: async () => {
          throw new Error("connection refused");
        },
      }),
    ).rejects.toThrow("bun run service:sequin:up");
  });

  test.each([
    "http",
    "all",
  ] as const)("%s role passes when Sequin is healthy", async (role) => {
    await expect(
      assertSequinHealthAvailable({
        role,
        healthUrl: "http://127.0.0.1:7376/health",
        fetchImpl: async () => new Response(null, { status: 204 }),
      }),
    ).resolves.toBeUndefined();
  });

  test("worker role skips the Sequin check", async () => {
    let called = false;

    await assertSequinHealthAvailable({
      role: "worker",
      fetchImpl: async () => {
        called = true;
        throw new Error("should not be called");
      },
    });

    expect(called).toBe(false);
  });
});
