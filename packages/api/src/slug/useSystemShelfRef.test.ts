import { describe, expect, test } from "bun:test";
import { computeSystemShelfRefResult } from "./useSystemShelfRef";

describe("computeSystemShelfRefResult", () => {
  test("loading state: authenticated, query in flight", () => {
    const result = computeSystemShelfRefResult({
      viewerUnitId: "alice",
      isLoading: true,
      data: undefined,
    });
    expect(result.isLoading).toBe(true);
    expect(result.unitId).toBeNull();
    expect(result.missing).toBe(false);
  });

  test("authenticated-missing: query settled with no row", () => {
    const result = computeSystemShelfRefResult({
      viewerUnitId: "alice",
      isLoading: false,
      data: { unitId: null } as any,
    });
    expect(result.isLoading).toBe(false);
    expect(result.unitId).toBeNull();
    expect(result.missing).toBe(true);
  });

  test("authenticated-missing: query settled with undefined data", () => {
    const result = computeSystemShelfRefResult({
      viewerUnitId: "alice",
      isLoading: false,
      data: undefined,
    });
    expect(result.missing).toBe(true);
  });

  test("authenticated-resolved: query settled with unitId", () => {
    const result = computeSystemShelfRefResult({
      viewerUnitId: "alice",
      isLoading: false,
      data: { unitId: "fav-shelf-id" } as any,
    });
    expect(result.isLoading).toBe(false);
    expect(result.unitId).toBe("fav-shelf-id");
    expect(result.missing).toBe(false);
  });

  test("unauthenticated: never flagged as missing", () => {
    const loadingState = computeSystemShelfRefResult({
      viewerUnitId: null,
      isLoading: true,
      data: undefined,
    });
    expect(loadingState.isLoading).toBe(false);
    expect(loadingState.missing).toBe(false);
    expect(loadingState.unitId).toBeNull();

    const settledState = computeSystemShelfRefResult({
      viewerUnitId: undefined,
      isLoading: false,
      data: undefined,
    });
    expect(settledState.isLoading).toBe(false);
    expect(settledState.missing).toBe(false);
    expect(settledState.unitId).toBeNull();
  });
});
