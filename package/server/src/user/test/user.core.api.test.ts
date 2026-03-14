import {beforeEach, describe, expect, mock, test} from 'bun:test';

const getByUnitId = mock(async () => {
  throw new Error('not found');
});

const provisionFromJwt = mock(
  async (payload: {unitId: string; slug?: string}) => ({
    unitId: payload.unitId,
    slug: payload.slug ?? payload.unitId,
    type: 'USER',
    name: payload.slug ?? payload.unitId,
    avatar: null,
    bio: null,
    description: null,
    followersCount: 0,
    followingsCount: 0,
    permission: null,
    joinDate: new Date('2026-03-08T00:00:00.000Z'),
  }),
);

mock.module('./user.service', () => ({
  userService: {
    getByUnitId,
    provisionFromJwt,
  },
}));

mock.module('./utils', () => ({
  verifyAuth: mock(async () => ({
    unitId: 'new-user-id',
    slug: 'alice',
    scope: 'user',
  })),
}));

describe('user core route', () => {
  beforeEach(() => {
    getByUnitId.mockClear();
    provisionFromJwt.mockClear();
  });

  test('GET /users/me provisions a profile when the user does not exist', async () => {
    const {userApi} = await import('../api/user.api');

    const response = await userApi.handle(
      new Request('http://localhost/users/me', {
        headers: {
          authorization: 'Bearer token',
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(getByUnitId).toHaveBeenCalledWith('new-user-id');
    expect(provisionFromJwt).toHaveBeenCalledWith({
      unitId: 'new-user-id',
      slug: 'alice',
    });

    expect(await response.json()).toEqual({
      unitId: 'new-user-id',
      slug: 'alice',
      type: 'USER',
      name: 'alice',
      followersCount: 0,
      followingsCount: 0,
      permission: null,
      joinDate: '2026-03-08T00:00:00.000Z',
    });
  });
});
