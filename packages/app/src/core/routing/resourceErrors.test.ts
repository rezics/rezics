import { ApiError } from "@rezics/contract/api";
import { describe, expect, test } from "bun:test";
import { routeQueryOrNotFound, isApiNotFoundError } from "./resourceErrors";

describe("resourceErrors", () => {
  test("classifies API 404 as not found", () => {
    expect(isApiNotFoundError(new ApiError(404, "NOT_FOUND", "Missing"))).toBe(
      true,
    );
    expect(isApiNotFoundError(new ApiError(500, "ERROR", "Failed"))).toBe(
      false,
    );
    expect(isApiNotFoundError(new Error("Missing"))).toBe(false);
  });

  test("returns route query data", async () => {
    const queryClient = {
      ensureQueryData: async () => ({ id: "resource-1" }),
    } as never;

    await expect(
      routeQueryOrNotFound(queryClient, {} as never),
    ).resolves.toEqual({ id: "resource-1" });
  });

  test("promotes failed route query to router not found", async () => {
    const queryClient = {
      ensureQueryData: async () => {
        throw new ApiError(404, "NOT_FOUND", "Missing");
      },
    } as never;

    await expect(
      routeQueryOrNotFound(queryClient, {} as never),
    ).rejects.toMatchObject({
      isNotFound: true,
    });
  });
});
