import {beforeEach, describe, expect, mock, test} from 'bun:test';

const fetchMock = mock();

mock.module('@package/app/env', () => ({
  env: {
    VITE_API_URL: 'http://api.example',
    VITE_AUTH_API_URL: 'http://auth.example',
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

describe('refreshAuthToken', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.window = {} as Window & typeof globalThis;
    globalThis.localStorage = createMemoryStorage() as Storage;
  });

  test('refreshes tokens through the auth service token endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({token: 'fresh-token'}), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const {getToken, refreshAuthToken} = await import('./http');

    await refreshAuthToken();

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://auth.example/api/auth/token');
    expect(options).toMatchObject({
      method: 'GET',
      credentials: 'include',
    });
    expect(getToken()).toBe('fresh-token');
  });

  test('throws when the auth service does not return a token', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );

    const {refreshAuthToken} = await import('./http');

    await expect(refreshAuthToken()).rejects.toThrow(
      'Unauthorized - Please login again',
    );
  });
});
