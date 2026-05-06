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
      authBaseUrl: "http://api.example",
    });
    globalThis.localStorage = createMemoryStorage() as Storage;
    globalThis.window = {
      dispatchEvent: () => true,
    } as unknown as Window & typeof globalThis;
  });

  test("does not persist browser auth or member session tokens", async () => {
    const jwt = await import("./jwt");

    const authToken = createToken({ sub: "user-1", slug: "reader" });
    const sessionToken = createToken({
      userId: "user-1",
      role: "MEMBER",
    });

    jwt.setToken(authToken, NormalizedTokenName.AUTH_SESSION);
    jwt.setToken(sessionToken, NormalizedTokenName.REZICS_SESSION);

    expect(jwt.getToken(NormalizedTokenName.AUTH_SESSION)).toBeNull();
    expect(jwt.getToken(NormalizedTokenName.REZICS_SESSION)).toBeNull();
    expect(localStorage.getItem(NormalizedTokenName.AUTH_SESSION)).toBeNull();
    expect(localStorage.getItem(NormalizedTokenName.REZICS_SESSION)).toBeNull();
  });
});
