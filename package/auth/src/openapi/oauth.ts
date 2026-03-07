import {Elysia} from 'elysia';
import {
  authorizeQuerySchema,
  tokenRequestBodySchema,
  tokenResponseSchema,
  userinfoResponseSchema,
  revokeTokenBodySchema,
  clientRegistrationBodySchema,
  clientRegistrationResponseSchema,
} from '@package/contract';
import {handleAuthRequest} from '../auth/routes';

export const oauthRouter = new Elysia()
  .get('/oauth/authorize', ({request}) => handleAuthRequest(request), {
    query: authorizeQuerySchema,
    detail: {
      summary: 'OAuth authorize',
      description: 'OAuth 2.0 authorization endpoint.',
      tags: ['OAuth'],
    },
  })
  .post('/oauth/token', ({request}) => handleAuthRequest(request), {
    body: tokenRequestBodySchema,
    response: tokenResponseSchema,
    detail: {
      summary: 'OAuth token',
      description: 'OAuth 2.0 token endpoint. Exchange authorization code for tokens.',
      tags: ['OAuth'],
    },
  })
  .get('/oauth/userinfo', ({request}) => handleAuthRequest(request), {
    response: userinfoResponseSchema,
    detail: {
      summary: 'OAuth userinfo',
      description: 'OpenID Connect UserInfo endpoint.',
      tags: ['OAuth'],
    },
  })
  .post('/oauth/revoke', ({request}) => handleAuthRequest(request), {
    body: revokeTokenBodySchema,
    detail: {
      summary: 'Revoke token',
      description: 'Revoke an access or refresh token.',
      tags: ['OAuth'],
    },
  })
  .get('/jwks', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'JWKS',
      description: 'JSON Web Key Set endpoint for token verification.',
      tags: ['OAuth'],
    },
  })
  .post('/oauth/register', ({request}) => handleAuthRequest(request), {
    body: clientRegistrationBodySchema,
    response: clientRegistrationResponseSchema,
    detail: {
      summary: 'Register OAuth client',
      description: 'Dynamic client registration endpoint.',
      tags: ['OAuth'],
    },
  })
  .get('/callback/:provider', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Social provider callback',
      description: 'OAuth callback endpoint for social authentication providers.',
      tags: ['Authentication'],
    },
  });
