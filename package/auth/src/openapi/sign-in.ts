import {Elysia} from 'elysia';
import {
  signInBodySchema,
  signUpBodySchema,
  authResponseSchema,
  signOutResponseSchema,
} from '@rezics/contract';
import {handleAuthRequest} from '../auth/routes';
import {jsonRequestBody, jsonResponse} from './docs';
import {authCorsPolicy} from '../cors';

export const signInRouter = new Elysia().use(authCorsPolicy('credentialed'))
  .post('/sign-in/email', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Sign in with email',
      description: 'Authenticate a user with email and password credentials.',
      tags: ['Authentication'],
      requestBody: jsonRequestBody(signInBodySchema),
      responses: {
        200: jsonResponse('Authentication successful.', authResponseSchema),
      },
    },
  })
  .post('/sign-up/email', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Sign up with email',
      description: 'Register a new user with name, email, and password.',
      tags: ['Authentication'],
      requestBody: jsonRequestBody(signUpBodySchema),
      responses: {
        200: jsonResponse('Registration successful.', authResponseSchema),
      },
    },
  })
  .post('/sign-out', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Sign out',
      description: 'End the current user session.',
      tags: ['Authentication'],
      responses: {
        200: jsonResponse('Sign-out successful.', signOutResponseSchema),
      },
    },
  });
