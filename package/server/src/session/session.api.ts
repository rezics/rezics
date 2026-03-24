import {Elysia} from 'elysia';
import {
  sessionTokenResponseSchema,
  type SessionTokenResponse,
} from '@package/contract';
import {serverCorsPolicy, requireLogin} from '@/middleware';
import {userService} from '@/user/service/user.service';
import {
  buildRezicsSessionClaims,
  getMainSessionPublicJwks,
  mainSessionJwtPlugin,
} from './jwt/jwt.service.ts';

export const sessionApi = new Elysia({prefix: '/session'})
  .use(serverCorsPolicy('credentialed'))
  .use(mainSessionJwtPlugin)
  .get('/jwks', async () => getMainSessionPublicJwks(), {
    corsPolicy: 'public',
    detail: {
      summary: 'Publish main-server JWKS',
      description:
        'Expose the canonical JWKS document for all main-server issued session tokens.',
      tags: ['Session'],
    },
  })
  .use(requireLogin)
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
