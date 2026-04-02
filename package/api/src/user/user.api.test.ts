import {beforeEach, describe, expect, mock, test} from 'bun:test';
import {NormalizedTokenName} from '@package/contract';
import {configureApi} from '../config';

const fetchMock = mock();

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

describe('userApi', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    configureApi({
      apiBaseUrl: 'http://api.example',
      authBaseUrl: 'http://auth.example',
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.window = {
      dispatchEvent: () => true,
      location: {
        hostname: 'app.example',
      },
    } as unknown as Window & typeof globalThis;
    globalThis.localStorage = createMemoryStorage() as Storage;
    globalThis.document = {
      cookie: '',
    } as Document;
  });

  test('sends identity and auth-context tokens using normalized transport headers', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: {unitId: 'user-1', name: 'Reader'},
          alreadyCreated: false,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const {setToken} = await import('../react-query/jwt');
    const {userApi} = await import('./user.api');

    setToken(
      'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
      NormalizedTokenName.AUTH_IDENTITY,
    );

    await userApi.ensure('context-token');

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization:
          'Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjQ3NjYwMDAwMDB9.c2ln',
        'x-auth-context-token': 'context-token',
      },
    });
  });
});
