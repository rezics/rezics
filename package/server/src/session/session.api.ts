import {Elysia} from 'elysia';
import {
  sessionTokenResponseSchema,
  type SessionTokenResponse,
} from '@package/contract';
import {coreInstance} from '@/src/core';
import {
  createPolicyCorsPreflightResponse,
  withPolicyCorsResponse,
} from '@/src/cors';
import {identityContextPlugin} from '@/src/auth/context';
import {userService} from '@/src/user/service/user.service';
import {
  buildRezicsSessionClaims,
  getMainSessionPublicJwks,
} from './jwt/jwt.service.ts';

const publicSessionApi = coreInstance('/session')
  .options('/jwks', ({request}) =>
    createPolicyCorsPreflightResponse(request, 'public'),
  )
  .get('/jwks', async () => getMainSessionPublicJwks(), {
    detail: {
      summary: 'Publish main-server JWKS',
      description:
        'Expose the canonical JWKS document for all main-server issued session tokens.',
      tags: ['Session'],
    },
    afterHandle: ({request, response}) =>
      withPolicyCorsResponse(request, response, 'public'),
  });

const credentialedSessionApi = coreInstance('/session')
  .options('/*', ({request}) =>
    createPolicyCorsPreflightResponse(request, 'credentialed'),
  )
  .onAfterHandle(({request, response}) =>
    withPolicyCorsResponse(request, response, 'credentialed'),
  )
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

export const sessionApi = new Elysia()
  .use(credentialedSessionApi)
  .use(publicSessionApi);
