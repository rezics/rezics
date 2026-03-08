import {Elysia} from 'elysia';
import {
  authTokenResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  revokeSessionBodySchema,
} from '@package/contract';
import {handleAuthRequest} from '../auth/routes';

export const sessionRouter = new Elysia()
  .get('/token', ({request}) => handleAuthRequest(request), {
    response: authTokenResponseSchema,
    detail: {
      summary: 'Get auth JWT',
      description:
        'Get a JWT for the current authenticated browser session.',
      tags: ['Session'],
    },
  })
  .get('/get-session', ({request}) => handleAuthRequest(request), {
    response: getSessionResponseSchema,
    detail: {
      summary: 'Get current session',
      description: 'Retrieve the current authenticated session and user info.',
      tags: ['Session'],
    },
  })
  .post('/list-sessions', ({request}) => handleAuthRequest(request), {
    response: listSessionsResponseSchema,
    detail: {
      summary: 'List sessions',
      description: 'List all active sessions for the current user.',
      tags: ['Session'],
    },
  })
  .post('/revoke-session', ({request}) => handleAuthRequest(request), {
    body: revokeSessionBodySchema,
    detail: {
      summary: 'Revoke session',
      description: 'Revoke a specific session by token.',
      tags: ['Session'],
    },
  });
