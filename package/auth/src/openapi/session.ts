import {Elysia} from 'elysia';
import {
  authTokenResponseSchema,
  getSessionResponseSchema,
  listSessionsResponseSchema,
  revokeSessionBodySchema,
} from '@package/contract';
import {handleAuthRequest} from '../auth/routes';
import {jsonRequestBody, jsonResponse} from './docs';

export const sessionRouter = new Elysia()
  .get('/token', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Get auth JWT',
      description:
        'Get a JWT for the current authenticated browser session.',
      tags: ['Session'],
      responses: {
        200: jsonResponse('Session JWT.', authTokenResponseSchema),
      },
    },
  })
  .get('/get-session', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Get current session',
      description: 'Retrieve the current authenticated session and user info.',
      tags: ['Session'],
      responses: {
        200: jsonResponse('Current session details.', getSessionResponseSchema),
      },
    },
  })
  .post('/list-sessions', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'List sessions',
      description: 'List all active sessions for the current user.',
      tags: ['Session'],
      responses: {
        200: jsonResponse('List of active sessions.', listSessionsResponseSchema),
      },
    },
  })
  .post('/revoke-session', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Revoke session',
      description: 'Revoke a specific session by token.',
      tags: ['Session'],
      requestBody: jsonRequestBody(revokeSessionBodySchema),
    },
  });
