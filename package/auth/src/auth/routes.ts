import {oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata} from '@better-auth/oauth-provider';
import {auth} from './instance';
import {enforceInternalTokenSurface} from './token-boundary';
import {AuthPolicyError} from './errors';

const openIdMetadataHandler = oauthProviderOpenIdConfigMetadata(auth);
const authServerMetadataHandler = oauthProviderAuthServerMetadata(auth);

function toJsonError(status: number, code: string, message: string): Response {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    {status},
  );
}

export async function handleAuthRequest(request: Request): Promise<Response> {
  try {
    enforceInternalTokenSurface(request);
  } catch (error) {
    if (error instanceof AuthPolicyError) {
      return toJsonError(error.status, error.code, error.message);
    }

    return toJsonError(500, 'AUTH_POLICY_ERROR', 'Unexpected auth policy error');
  }

  return auth.handler(request);
}

export async function handleJwksCompatibilityRequest(request: Request): Promise<Response> {
  const jwksUrl = new URL('/api/auth/jwks', request.url);
  return auth.handler(new Request(jwksUrl, request));
}

export async function handleOpenIdConfigRequest(request: Request): Promise<Response> {
  return openIdMetadataHandler(request);
}

export async function handleOAuthAuthorizationServerRequest(
  request: Request,
): Promise<Response> {
  return authServerMetadataHandler(request);
}
