import {Elysia} from 'elysia';
import {openapi} from '@elysiajs/openapi';
import {
  createJwtVerifier,
  createTokenResolver,
  JwtAlgorithm,
} from '@package/jwt';
import type {
  AuthIdentityTokenClaims,
  RezicsSessionTokenClaims,
} from '@package/contract';
import {
  NormalizedTokenName,
  TokenContextKey,
  TokenTransportHeader,
  normalizedTokenTransportMap,
} from '@package/contract';
import {bookApi} from './book';
import {chapterApi} from './chapter';
import {readlistApi} from './readlist';
import {reviewApi} from './review';
import {userApi} from './user';
import {meiliApi} from './meili';
import {unitApi} from './unit';
import {tagApi} from './tag';
import {echoKvApi} from './echokv';
import {commentApi} from './comment';
import {reactionApi} from './reaction';
import {tokenApi} from './token';
import {feedbackApi} from './feedback';
import {sessionApi} from './session';
import {jwtServiceAdminApi} from './jwt';

import {applyCorsToSet} from '@package/cors';
import {getProdState} from './utils/getProdState';
import {env} from './env';
import {bootstrapJwtServiceRecord, getJwtService} from './jwt';
import {
  serverSessionJwksPath,
  authSessionJwksPath,
} from './session/jwt/jwt-metadata';
import {serverConfigs} from '@/middleware';

import 'dotenv/config';

const {isProd, isDev} = getProdState();

const app = new Elysia();

if (isDev) {
  await import('./utils/logger-hook');
  app.use(openapi()).trace(async ({onHandle, context}) => {
    onHandle(({begin, onStop}) => {
      const {route, params, request} = context;

      onStop(({end}) => {
        console.log(
          `[${request.method}] ${route} took ${end - begin}ms`,
          'params:',
          params,
        );
      });
    });
  });
}

const port = env.PORT ? Number(env.PORT) : 3000;

const serverBaseUrl = env.MAIN_SESSION_JWT_ISSUER ?? `http://localhost:${port}`;
const authIssuer = env.AUTH_JWT_ISSUER ?? 'http://localhost:3001';
const authAudience = env.AUTH_JWT_AUDIENCE ?? 'rezics-api';
const authJwksUrl =
  env.AUTH_JWKS_URL ?? new URL(authSessionJwksPath, authIssuer).toString();

await Promise.all([
  bootstrapJwtServiceRecord('server-local', {
    issuer: serverBaseUrl,
    audience: env.MAIN_SESSION_JWT_AUDIENCE ?? 'rezics-main-server',
    jwksUrl: new URL(serverSessionJwksPath, serverBaseUrl).toString(),
    jwksPath: serverSessionJwksPath,
    isLocalIssuer: true,
  }),
  bootstrapJwtServiceRecord('auth-upstream', {
    issuer: authIssuer,
    audience: authAudience,
    jwksUrl: authJwksUrl,
    jwksPath: authSessionJwksPath,
    isLocalIssuer: false,
  }),
]);

const authUpstream = await getJwtService('auth-upstream');
const serverLocal = await getJwtService('server-local');

const authIdentityVerifier = createJwtVerifier<AuthIdentityTokenClaims>({
  issuer: authUpstream.issuer,
  audience: authUpstream.audience,
  jwksUrl: authUpstream.jwksUrl,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.AUTH_IDENTITY,
  clockToleranceSeconds: Number(env.AUTH_JWT_CLOCK_TOLERANCE_SECONDS ?? '5'),
  requiredScope: 'user',
  enforceTransport: true,
});

const rezicsSessionVerifier = createJwtVerifier<RezicsSessionTokenClaims>({
  issuer: serverLocal.issuer,
  audience: serverLocal.audience,
  jwksUrl: serverLocal.jwksUrl,
  algorithm: JwtAlgorithm.ES256,
  tokenName: NormalizedTokenName.REZICS_SESSION,
  clockToleranceSeconds: 5,
  enforceTransport: true,
});

app
  .onError(({code, error, request, set}) => {
    if (!set.headers['access-control-allow-origin']) {
      applyCorsToSet(request, set.headers, serverConfigs['credentialed']);
    }

    set.status ||= 500;
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    return {
      status: set.status,
      code,
      message,
    };
  })
  .use(
    createTokenResolver<
      typeof TokenContextKey.AUTH_IDENTITY,
      AuthIdentityTokenClaims
    >(TokenContextKey.AUTH_IDENTITY, {
      headerName: TokenTransportHeader.AUTHORIZATION,
      usesBearer: true,
      verifier: authIdentityVerifier,
    }),
  )
  .use(
    createTokenResolver<
      typeof TokenContextKey.REZICS_SESSION,
      RezicsSessionTokenClaims
    >(TokenContextKey.REZICS_SESSION, {
      headerName: TokenTransportHeader.REZICS_SESSION,
      usesBearer: false,
      verifier: rezicsSessionVerifier,
    }),
  )
  .use(bookApi)
  .use(chapterApi)
  .use(readlistApi)
  .use(reviewApi)
  .use(userApi)
  .use(meiliApi)
  .use(unitApi)
  .use(tagApi)
  .use(commentApi)
  .use(reactionApi)
  .use(tokenApi)
  .use(echoKvApi)
  .use(feedbackApi)
  .use(sessionApi)
  .use(jwtServiceAdminApi)
  .get('/', () => 'Hello Elysia')
  .get('/health', () => ({status: 'ok'}));

app.listen(port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
  `\n🔗 Openapi UI: http://${app.server?.hostname}:${app.server?.port}/openapi`,
);
