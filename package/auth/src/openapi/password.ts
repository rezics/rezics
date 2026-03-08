import {Elysia} from 'elysia';
import {
  requestPasswordResetBodySchema,
  requestPasswordResetResponseSchema,
  resetPasswordBodySchema,
  resetPasswordCallbackParamsSchema,
  resetPasswordCallbackQuerySchema,
  resetPasswordCallbackResponseSchema,
  resetPasswordResponseSchema,
} from '@package/contract';
import {handleAuthRequest} from '../auth/routes';

export const passwordRouter = new Elysia()
  .post('/request-password-reset', ({request}) => handleAuthRequest(request), {
    body: requestPasswordResetBodySchema,
    response: requestPasswordResetResponseSchema,
    detail: {
      summary: 'Request password reset',
      description: 'Send a password reset email if the account exists.',
      tags: ['Authentication'],
    },
  })
  .get('/reset-password/:token', ({request}) => handleAuthRequest(request), {
    params: resetPasswordCallbackParamsSchema,
    query: resetPasswordCallbackQuerySchema,
    response: resetPasswordCallbackResponseSchema,
    detail: {
      summary: 'Password reset callback',
      description:
        'Validate a password reset token and redirect back to the supplied callback URL.',
      tags: ['Authentication'],
    },
  })
  .post('/reset-password', ({request}) => handleAuthRequest(request), {
    body: resetPasswordBodySchema,
    response: resetPasswordResponseSchema,
    detail: {
      summary: 'Reset password',
      description: 'Reset a user password with a valid reset token.',
      tags: ['Authentication'],
    },
  });
