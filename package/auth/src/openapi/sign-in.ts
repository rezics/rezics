import {Elysia} from 'elysia';
import {
  signInBodySchema,
  signUpBodySchema,
  authResponseSchema,
  signOutResponseSchema,
} from '@package/contract';
import {handleAuthRequest} from '../auth/routes';

export const signInRouter = new Elysia()
  .post('/sign-in/email', ({request}) => handleAuthRequest(request), {
    // body: signInBodySchema,
    response: authResponseSchema,
    detail: {
      summary: 'Sign in with email',
      description: 'Authenticate a user with email and password credentials.',
      tags: ['Authentication'],
      requestBody: {
        content: {
          'application/json': {
            schema: signInBodySchema,
          },
        },
      },
    },
  })
  .post('/sign-up/email', ({request}) => handleAuthRequest(request), {
    body: signUpBodySchema,
    response: authResponseSchema,
    detail: {
      summary: 'Sign up with email',
      description: 'Register a new user with name, email, and password.',
      tags: ['Authentication'],
    },
  })
  .post('/sign-out', ({request}) => handleAuthRequest(request), {
    response: signOutResponseSchema,
    detail: {
      summary: 'Sign out',
      description: 'End the current user session.',
      tags: ['Authentication'],
    },
  });
