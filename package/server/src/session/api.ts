import {Elysia} from 'elysia';
import {
  sessionTokenResponseSchema,
  type SessionTokenResponse,
} from '@package/contract';
import {coreInstance} from '@/src/core';
import {identityContextPlugin} from '@/src/auth/context';
import {userService} from '@/src/user/service/user.service';
import {buildRezicsSessionClaims} from './jwt';

export const sessionApi = coreInstance('/session')
  .use(identityContextPlugin)
  .post(
    '/token',
    async ({identity, jwt}): Promise<SessionTokenResponse> => {
      const user = await userService.getByUnitId(identity.unitId);

      return {
        token: await jwt.sign(
          buildRezicsSessionClaims({
            unitId: user.unitId,
            roles: (user.permission as {role?: string[]} | null)?.role,
          }),
        ),
      };
    },
    {
      response: sessionTokenResponseSchema,
      detail: {
        summary: 'Issue main-server session token',
        description:
          'Issue the main-server session token after auth identity verification and local user ensure.',
        tags: ['Session'],
      },
    },
  );
