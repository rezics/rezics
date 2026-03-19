import {Elysia} from 'elysia';
import {
  authorizeQuerySchema,
  listAuthProvidersResponseSchema,
  signInSocialBodySchema,
  signInSocialResponseSchema,
  tokenRequestBodySchema,
  tokenResponseSchema,
  userinfoResponseSchema,
  revokeTokenBodySchema,
  clientRegistrationBodySchema,
  clientRegistrationResponseSchema,
} from '@package/contract';
import {
  handleAuthRequest,
  handleJwksCompatibilityRequest,
  handleOAuthAuthorizationServerRequest,
  handleOpenIdConfigRequest,
} from '../auth/routes';
import {jsonRequestBody, jsonResponse, parameter} from './docs';
import {getConfiguredSocialProviders} from '../auth/providers';
import {
  coreInstance,
} from '../core';
import {withPublicCors} from '../cors';

const oauthFlowRouter = withPublicCors(coreInstance())
  .get(
    '/providers',
    () => ({
      /**
       * TODO Add location information related sort logic
       */
      providers: getConfiguredSocialProviders().filter(
        provider => provider.enabled,
      ),
    }),
    {
      detail: {
        summary: 'List configured social providers',
        description:
          'Return the social sign-in providers that are enabled by backend configuration.',
        tags: ['OAuth'],
        responses: {
          200: jsonResponse(
            'Configured social providers.',
            listAuthProvidersResponseSchema,
          ),
        },
      },
    },
  )
  .post('/sign-in/social', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Start social sign-in',
      description:
        'Start a Better Auth social provider flow and optionally return the redirect URL without navigating.',
      tags: ['Authentication'],
      requestBody: jsonRequestBody(signInSocialBodySchema),
      responses: {
        200: jsonResponse(
          'Social sign-in redirect payload.',
          signInSocialResponseSchema,
        ),
      },
    },
  })
  .get('/oauth/authorize', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'OAuth authorize',
      description: 'OAuth 2.0 authorization endpoint.',
      tags: ['OAuth'],
      parameters: [
        parameter({
          name: 'client_id',
          in: 'query',
          required: true,
          schema: authorizeQuerySchema.properties.client_id,
        }),
        parameter({
          name: 'redirect_uri',
          in: 'query',
          required: true,
          schema: authorizeQuerySchema.properties.redirect_uri,
        }),
        parameter({
          name: 'response_type',
          in: 'query',
          required: true,
          schema: authorizeQuerySchema.properties.response_type,
        }),
        parameter({
          name: 'scope',
          in: 'query',
          required: false,
          schema: authorizeQuerySchema.properties.scope,
        }),
        parameter({
          name: 'state',
          in: 'query',
          required: false,
          schema: authorizeQuerySchema.properties.state,
        }),
      ],
    },
  })
  .post('/oauth/token', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'OAuth token',
      description:
        'OAuth 2.0 token endpoint. Exchange authorization code for tokens.',
      tags: ['OAuth'],
      requestBody: jsonRequestBody(tokenRequestBodySchema),
      responses: {
        200: jsonResponse('OAuth token response.', tokenResponseSchema),
      },
    },
  })
  .get('/oauth/userinfo', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'OAuth userinfo',
      description: 'OpenID Connect UserInfo endpoint.',
      tags: ['OAuth'],
      responses: {
        200: jsonResponse('OpenID user info.', userinfoResponseSchema),
      },
    },
  })
  .post('/oauth/revoke', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Revoke token',
      description: 'Revoke an access or refresh token.',
      tags: ['OAuth'],
      requestBody: jsonRequestBody(revokeTokenBodySchema),
    },
  })
  .post('/oauth/register', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Register OAuth client',
      description: 'Dynamic client registration endpoint.',
      tags: ['OAuth'],
      requestBody: jsonRequestBody(clientRegistrationBodySchema),
      responses: {
        200: jsonResponse(
          'OAuth client registration result.',
          clientRegistrationResponseSchema,
        ),
      },
    },
  })
  .get('/callback/:provider', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Social provider callback',
      description:
        'OAuth callback endpoint for social authentication providers.',
      tags: ['Authentication'],
      parameters: [
        parameter({
          name: 'provider',
          in: 'path',
          required: true,
          schema: {
            type: 'string',
          },
        }),
      ],
    },
  });

const oauthDiscoveryRouter = withPublicCors(coreInstance())
  .get('/.well-known/jwks.json', ({request}) =>
    handleJwksCompatibilityRequest(request),
    {
      detail: {
        summary: 'JWKS compatibility endpoint',
        description:
          'Compatibility JWKS endpoint for OAuth/OIDC clients and resource servers that expect the standard discovery path `/.well-known/jwks.json`. It returns the same public signing keys as the canonical session-owned endpoint `/session/jwks`.',
        tags: ['OAuth'],
      },
    },
  )
  .get('/.well-known/openid-configuration', ({request}) =>
    handleOpenIdConfigRequest(request),
    {
      detail: {
        summary: 'OpenID Connect discovery document',
        description:
          'OpenID Connect discovery metadata endpoint. Clients use this document to discover the issuer, authorization endpoint, token endpoint, userinfo endpoint, JWKS URI, supported scopes, and other OIDC capabilities exposed by this authorization server.',
        tags: ['OAuth'],
      },
    },
  )
  .get('/.well-known/oauth-authorization-server', ({request}) =>
    handleOAuthAuthorizationServerRequest(request),
    {
      detail: {
        summary: 'OAuth authorization server metadata',
        description:
          'OAuth 2.0 Authorization Server Metadata endpoint. OAuth clients can use this document to discover server capabilities such as issuer identity, authorization and token endpoints, supported grant types, and related protocol metadata without depending on OIDC-specific discovery.',
        tags: ['OAuth'],
      },
    },
  );

export const oauthRouter = new Elysia()
  .use(oauthFlowRouter)
  .use(oauthDiscoveryRouter);
