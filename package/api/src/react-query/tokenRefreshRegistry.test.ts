import { describe, expect, mock, test } from "bun:test";
import { NormalizedTokenName } from "@rezics/contract";

mock.module("../user/user.api", () => ({
  userApi: {
    issueSessionToken: mock(async () => ({ token: "session-token" })),
  },
}));

mock.module("@rezics/app-shell/state/authSessionStore", () => ({
  useAuthSessionStore: {
    getState: () => ({
      syncBusinessToken: mock(() => undefined),
    }),
  },
}));

describe("createTokenRefreshRegistry", () => {
  test("default registry contains REZICS_SESSION entry", async () => {
    const { createTokenRefreshRegistry } = await import(
      "./tokenRefreshRegistry"
    );
    const registry = createTokenRefreshRegistry();

    expect(registry[NormalizedTokenName.REZICS_SESSION]).toBeDefined();
    expect(typeof registry[NormalizedTokenName.REZICS_SESSION]).toBe(
      "function",
    );
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
