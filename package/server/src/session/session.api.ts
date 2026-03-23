import {
  sessionTokenResponseSchema,
  type SessionTokenResponse,
} from '@package/contract';
import {coreInstance} from '@/src/core';
import {serverCorsPolicy} from '@/src/middleware';
import {identityContextPlugin} from '@/src/middleware';
import {userService} from '@/src/user/service/user.service';
import {
  buildRezicsSessionClaims,
  getMainSessionPublicJwks,
} from './jwt/jwt.service.ts';

export const sessionApi = coreInstance('/session')
  .use(serverCorsPolicy('credentialed'))
  .get('/jwks', async () => getMainSessionPublicJwks(), {
    corsPolicy: 'public',
    detail: {
      summary: 'Publish main-server JWKS',
      description:
        'Expose the canonical JWKS document for all main-server issued session tokens.',
      tags: ['Session'],
    },
  })
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
