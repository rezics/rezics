import { beforeEach, describe, expect, mock, test } from "bun:test";
import { NormalizedTokenName } from "@rezics/contract";
import { configureApi } from "../config";

const fetchMock = mock();
let authPresence = false;

mock.module("./authPresence", () => ({
  hasAuthPresence: () => authPresence,
  clearAuthPresence: () => {
    authPresence = false;
  },
}));

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

describe("refreshAuthToken", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    authPresence = false;
    configureApi({
      apiBaseUrl: "http://api.example",
      authBaseUrl: "http://auth.example",
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.window = {
      dispatchEvent: () => true,
      location: {
        hostname: "app.example",
      },
    } as unknown as Window & typeof globalThis;
    globalThis.localStorage = createMemoryStorage() as Storage;
    globalThis.document = {
      cookie: "",
    } as Document;
  });

  test("retries 401 responses only when auth presence exists", async () => {
    authPresence = true;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Expired" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "fresh-token" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { apiFetch } = await import("./http");
    const { getToken } = await import("./jwt");

    const result = await apiFetch<{ ok: boolean }>("/books");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://auth.example/api/auth/token",
    );
    expect(result).toEqual({ ok: true });
    expect(getToken()).toBe("fresh-token");
  });

  test("does not probe auth token refresh when auth presence is absent", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Expired" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { apiFetch } = await import("./http");

    await expect(apiFetch("/books")).rejects.toThrow("Expired");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("builds managed auth headers from normalized token storage", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { apiFetch } = await import("./http");
    const { setToken } = await import("./jwt");

    setToken(
      "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln",
      NormalizedTokenName.AUTH_IDENTITY,
    );
    setToken("member-token", NormalizedTokenName.REZICS_SESSION);

    await apiFetch("/books", {
      headers: {
        "x-trace-id": "trace-1",
      },
    });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: "Bearer member-token",
        "x-trace-id": "trace-1",
      },
    });
  });
});
