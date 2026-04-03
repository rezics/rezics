import {Elysia} from 'elysia';
import {
  changeEmailBodySchema,
  changeEmailResponseSchema,
  sendVerificationEmailBodySchema,
  sendVerificationEmailResponseSchema,
  setPasswordBodySchema,
  setPasswordResponseSchema,
  verifyEmailQuerySchema,
  verifyEmailResponseSchema,
} from '@rezics/contract';
import {handleAuthRequest} from '../auth/routes';
import {jsonRequestBody, jsonResponse, parameter} from './docs';
export const selfServiceRouter = new Elysia()
  .post('/send-verification-email', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Send verification email',
      description:
        'Send or resend an account verification email for the current auth user.',
      tags: ['Authentication'],
      requestBody: jsonRequestBody(sendVerificationEmailBodySchema),
      responses: {
        200: jsonResponse(
          'Verification email request accepted.',
          sendVerificationEmailResponseSchema,
        ),
      },
    },
  })
  .get('/verify-email', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Verify email',
      description: 'Verify the current user email with a Better Auth token.',
      tags: ['Authentication'],
      parameters: [
        parameter({
          name: 'token',
          in: 'query',
          required: true,
          schema: verifyEmailQuerySchema.properties.token,
        }),
        parameter({
          name: 'callbackURL',
          in: 'query',
          required: false,
          schema: verifyEmailQuerySchema.properties.callbackURL,
        }),
      ],
      responses: {
        200: jsonResponse(
          'Email verification result.',
          verifyEmailResponseSchema,
        ),
      },
    },
  })
  .post('/change-email', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Change email',
      description:
        'Update the authenticated user email or start its verification flow.',
      tags: ['Authentication'],
      requestBody: jsonRequestBody(changeEmailBodySchema),
      responses: {
        200: jsonResponse(
          'Email change request accepted.',
          changeEmailResponseSchema,
        ),
      },
    },
  })
  .post('/set-password', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Set password',
      description:
        'Set an email-password credential for the authenticated account when none exists yet.',
      tags: ['Authentication'],
      requestBody: jsonRequestBody(setPasswordBodySchema),
      responses: {
        200: jsonResponse(
          'Password set successfully.',
          setPasswordResponseSchema,
        ),
      },
    },
  });
