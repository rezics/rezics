import {Elysia} from 'elysia';
import {
  authContextTokenResponseSchema,
  authTokenResponseSchema,
  getSessionResponseSchema,
  getSessionStateResponseSchema,
  listSessionsResponseSchema,
  revokeSessionBodySchema,
} from '@package/contract';
import {coreInstance} from '../core';
import {
  createPolicyCorsPreflightResponse,
  withPolicyCorsResponse,
} from '../cors';
import {handleAuthRequest} from '../auth/routes';
import {jsonRequestBody, jsonResponse} from './docs';
import {listEnabledSocialProviderIds} from '../auth/providers';
import {env} from '../env';
import {verifyAuthIdentityToken} from '../session/jwt/verify';

async function forwardAuthRequest(
  request: Request,
  path: string,
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = path;
  return handleAuthRequest(new Request(url, request));
}

async function getSessionStateResponse(request: Request): Promise<Response> {
  const response = await forwardAuthRequest(
    request,
    `${env.AUTH_OPENAPI_ROUTER_PREFIX}/get-session`,
  );

  if (!response.ok) {
    return response;
  }

  const sessionData = (await response.json()) as Partial<{
    session: {
      id: string;
      token: string;
      expiresAt: string;
      userId: string;
    };
    user: {
      id: string;
      name: string;
      role: string;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      createdAt: string;
      updatedAt: string;
    };
  }> &
    Record<string, unknown>;

  if (!sessionData.session || !sessionData.user?.id) {
    return Response.json(sessionData);
  }

  const {prisma} = await import('../auth/prisma');
  const accounts = await prisma.account.findMany({
    where: {
      userId: sessionData.user.id,
    },
    select: {
      providerId: true,
      password: true,
    },
  });

  const providerIds = Array.from(
    new Set(
      accounts
        .map((account: {providerId: string}) => account.providerId)
        .filter(
          (
            providerId: string,
          ): providerId is ReturnType<
            typeof listEnabledSocialProviderIds
          >[number] =>
            providerId !== 'credential' &&
            listEnabledSocialProviderIds().includes(
              providerId as ReturnType<
                typeof listEnabledSocialProviderIds
              >[number],
            ),
        ),
    ),
  );

  const hasPassword = accounts.some(
    (account: {providerId: string; password: string | null}) =>
      account.providerId === 'credential' && Boolean(account.password),
  );
  const needsOnboarding =
    providerIds.length > 0 && !sessionData.user.emailVerified;
  const canAcquireMemberToken =
    sessionData.user.emailVerified && !needsOnboarding;
  const readinessStatus = needsOnboarding
    ? 'needs-onboarding'
    : sessionData.user.emailVerified
      ? 'ready'
      : 'needs-verification';

  return Response.json({
    ...sessionData,
    authSession: {
      email: sessionData.user.email,
      emailVerified: sessionData.user.emailVerified,
      needsEmailVerification: !sessionData.user.emailVerified,
      needsOnboarding,
      canAcquireMemberToken,
      readinessStatus,
      hasPassword,
      canSetPassword: !hasPassword,
      providerIds,
      primaryProviderId: providerIds[0],
      trustedProviderId: sessionData.user.emailVerified
        ? providerIds[0]
        : undefined,
    },
  });
}

/**
 * Issue a context token from a verified auth identity Bearer token.
 * Extracts the userId from the identity token claims, queries the
 * user record directly, and signs a new context token using the
 * same JWKS signing key as `/auth/token`.
 */
async function getContextTokenResponse(request: Request): Promise<Response> {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return Response.json(
      {message: 'Unauthorized: Missing Authorization header'},
      {status: 401},
    );
  }

  let userId: string;
  try {
    const verified = await verifyAuthIdentityToken(authorization);
    userId = verified.payload.sub ?? '';
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message
            : 'Unauthorized: Invalid identity token',
      },
      {status: 401},
    );
  }

  if (!userId) {
    return Response.json(
      {message: 'Unauthorized: Missing user identity'},
      {status: 401},
    );
  }

  const {prisma} = await import('../auth/prisma');
  const user = await prisma.user.findUnique({
    where: {id: userId},
    select: {
      id: true,
      name: true,
      emailVerified: true,
      image: true,
      profile: {
        select: {
          slug: true,
          avatar: true,
        },
      },
    },
  });

  if (!user) {
    return Response.json(
      {message: 'Unauthorized: User not found'},
      {status: 401},
    );
  }

  const {signAuthContextToken} = await import('../session/jwt/context-token');
  return Response.json(await signAuthContextToken(user));
}

const credentialedSessionRouter = coreInstance()
  .options('/*', ({request}) =>
    createPolicyCorsPreflightResponse(request, 'credentialed'),
  )
  .onAfterHandle(({request, response}) =>
    withPolicyCorsResponse(request, response, 'credentialed'),
  )
  .get('/token', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'Get auth JWT',
      description: 'Get a JWT for the current authenticated browser session.',
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
  .get('/get-session-state', ({request}) => getSessionStateResponse(request), {
    detail: {
      summary: 'Get normalized session state',
      description:
        'Retrieve the current authenticated session together with readiness fields used by onboarding flows.',
      tags: ['Session'],
      responses: {
        200: jsonResponse(
          'Current session details with onboarding state.',
          getSessionStateResponseSchema,
        ),
      },
    },
  })
  .get('/context-token', ({request}) => getContextTokenResponse(request), {
    detail: {
      summary: 'Get auth context JWT',
      description:
        'Get an auth-owned context token for onboarding and first-time user provisioning.',
      tags: ['Session'],
      responses: {
        200: jsonResponse(
          'Auth context JWT and decoded claims.',
          authContextTokenResponseSchema,
        ),
      },
    },
  })
  .post('/list-sessions', ({request}) => handleAuthRequest(request), {
    detail: {
      summary: 'List sessions',
      description: 'List all active sessions for the current user.',
      tags: ['Session'],
      responses: {
        200: jsonResponse(
          'List of active sessions.',
          listSessionsResponseSchema,
        ),
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

const publicSessionRouter = coreInstance()
  .options('/session/jwks', ({request}) =>
    createPolicyCorsPreflightResponse(request, 'public'),
  )
  .get(
    '/session/jwks',
    async () => {
      const {getAuthSessionJwksResponse} =
        await import('../session/jwt/routes');
      return getAuthSessionJwksResponse();
    },
    {
      detail: {
        summary: 'Session JWKS public keys',
        description:
          'Canonical session-owned JSON Web Key Set (JWKS) endpoint for offline verification of auth-issued JWTs.',
        tags: ['Session'],
      },
      afterHandle: ({request, response}) =>
        withPolicyCorsResponse(request, response, 'public'),
    },
  );

export const sessionRouter = new Elysia()
  .use(credentialedSessionRouter)
  .use(publicSessionRouter);
