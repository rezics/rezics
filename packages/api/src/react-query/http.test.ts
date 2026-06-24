import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
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
      authBaseUrl: "http://api.example",
      reactionServiceUrl: "http://reaction.example",
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

  afterEach(() => {
    delete (globalThis as Partial<typeof globalThis>).window;
    delete (globalThis as Partial<typeof globalThis>).localStorage;
    delete (globalThis as Partial<typeof globalThis>).document;
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
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { apiFetch } = await import("./http");

    const result = await apiFetch<{ ok: boolean }>("/book");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "http://api.example/auth/session/refresh",
    );
    expect(result).toEqual({ ok: true });
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

    await expect(apiFetch("/book")).rejects.toThrow("Expired");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not inject browser session tokens into authorization headers", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    const { apiFetch } = await import("./http");

    await apiFetch("/book", {
      headers: {
        "x-trace-id": "trace-1",
      },
    });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        "x-trace-id": "trace-1",
      },
    });
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({
      headers: {
        Authorization: expect.any(String),
      },
    });
  });

  test("preserves auth presence when main session refresh reports setup required", async () => {
    authPresence = true;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "REGISTRATION_INCOMPLETE",
            message: "Main account setup is required",
          },
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const { queryAccessToken, MainSessionRefreshError } = await import("./jwt");

    await expect(queryAccessToken()).rejects.toBeInstanceOf(
      MainSessionRefreshError,
    );
    expect(authPresence).toBe(true);
  });
});
