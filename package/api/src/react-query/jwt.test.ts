import { beforeEach, describe, expect, test } from "bun:test";
import { NormalizedTokenName } from "@rezics/contract";
import { configureApi } from "../config";

type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
};

function createMemoryStorage(): MemoryStorage {
  const store = new Map<string, string>();

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function createToken(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload))
    .toString("base64url")
    .replace(/=/g, "");
  return `header.${encoded}.signature`;
}

describe("jwt token storage", () => {
  beforeEach(() => {
    configureApi({
      apiBaseUrl: "http://api.example",
      authBaseUrl: "http://auth.example",
    });
    globalThis.localStorage = createMemoryStorage() as Storage;
    globalThis.window = {
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis;
  });

  test("stores auth identity and member session tokens separately", async () => {
    const jwt = await import("./jwt");

    const identityToken = createToken({ sub: "user-1", slug: "reader" });
    const sessionToken = createToken({
      unitId: "user-1",
      permission: { role: "USER" },
    });

    jwt.setToken(identityToken, NormalizedTokenName.AUTH_IDENTITY);
    jwt.setToken(sessionToken, NormalizedTokenName.REZICS_SESSION);

    expect(jwt.getToken(NormalizedTokenName.AUTH_IDENTITY)).toBe(identityToken);
    expect(jwt.getToken(NormalizedTokenName.REZICS_SESSION)).toBe(sessionToken);
    expect(jwt.getRezicsSessionClaims()).toMatchObject({
      unitId: "user-1",
    });
  });

  test("AUTH_CONTEXT is not persisted but can be parsed from raw token", async () => {
    const jwt = await import("./jwt");

    const contextToken = createToken({
      id: "user-1",
      slug: "reader",
      name: "Reader",
      verificationStatus: "pending",
    });

    expect(jwt.getAuthContextClaims(contextToken)).toMatchObject({
      id: "user-1",
      verificationStatus: "pending",
    });
    expect(jwt.getAuthContextClaims()).toBeNull();
  });
});
