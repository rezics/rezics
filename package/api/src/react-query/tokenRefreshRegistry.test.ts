import { describe, expect, test } from "bun:test";
import { NormalizedTokenName } from "@rezics/contract";

describe("createTokenRefreshRegistry", () => {
  test("default registry is empty for cookie-backed browser sessions", async () => {
    const { createTokenRefreshRegistry } = await import(
      "./tokenRefreshRegistry"
    );
    const registry = createTokenRefreshRegistry();

    expect(registry[NormalizedTokenName.REZICS_SESSION]).toBeUndefined();
  });

  test("override replaces default entry", async () => {
    const { createTokenRefreshRegistry } = await import(
      "./tokenRefreshRegistry"
    );
    const customFn = async () => ({ token: "custom-token" });
    const registry = createTokenRefreshRegistry({
      [NormalizedTokenName.REZICS_SESSION]: customFn,
    });

    expect(registry[NormalizedTokenName.REZICS_SESSION]).toBe(customFn);
  });
});
