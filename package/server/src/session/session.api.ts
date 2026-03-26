import {Elysia} from 'elysia';
import {
  sessionTokenResponseSchema,
  type SessionTokenResponse,
} from '@package/contract';
import {
  serverCorsPolicy,
  requireLogin,
  getAuthSessionState,
  assertMainServerEligibility,
} from '@/middleware';
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
    async ({identity, headers, jwt, set}): Promise<SessionTokenResponse> => {
      const authorization = headers.authorization;
      if (!authorization) {
        set.status = 401;
        throw new Error('Unauthorized: Missing authorization header');
      }

      let sessionState;
      try {
        sessionState = await getAuthSessionState(authorization);
      } catch {
        set.status = 503;
        throw new Error(
          'Service Unavailable: Unable to verify auth session eligibility',
        );
      }

      try {
        assertMainServerEligibility(sessionState);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Eligibility check failed';
        if (message.includes('Unauthorized')) {
          set.status = 401;
        } else {
          set.status = 403;
        }
        throw error;
      }

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
