import {betterAuth} from 'better-auth';
import {prismaAdapter} from '@better-auth/prisma-adapter';
import {jwt} from 'better-auth/plugins';
import {oauthProvider} from '@better-auth/oauth-provider';
import {createHash} from 'node:crypto';
import {prisma} from './prisma';
import {env} from '../env';

const authAudience = env.AUTH_JWT_AUDIENCE ?? 'rezics-api';
const authIssuer = env.AUTH_JWT_ISSUER ?? env.BETTER_AUTH_URL;
const authJwtTtlSeconds = Number(env.AUTH_JWT_TTL_SECONDS ?? '3600');
const authJwksRotationIntervalSeconds = Number(
  env.AUTH_JWKS_ROTATION_INTERVAL_SECONDS ?? '86400',
);
const authJwksGracePeriodSeconds = Number(
  env.AUTH_JWKS_GRACE_PERIOD_SECONDS ?? '3900',
);
const prismaAny = prisma as any;

function deriveDeterministicKid(publicKey: string): string {
  return createHash('sha256').update(publicKey).digest('hex').slice(0, 32);
}

export const auth = betterAuth({
  appName: 'Rezics Auth',
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  trustedOrigins: [env.BETTER_AUTH_URL],
  emailAndPassword: {
    enabled: true,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'microsoft', 'github', 'twitter'],
      allowDifferentEmails: false,
    },
  },
  socialProviders: {
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    } : undefined,
    microsoft: env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET ? {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
    } : undefined,
    github: env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    } : undefined,
    twitter: env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET ? {
      clientId: env.TWITTER_CLIENT_ID,
      clientSecret: env.TWITTER_CLIENT_SECRET,
    } : undefined,
  },
  plugins: [
    jwt({
      jwks: {
        keyPairConfig: {
          alg: 'ES256',
        },
        rotationInterval: authJwksRotationIntervalSeconds,
        gracePeriod: authJwksGracePeriodSeconds,
      },
      adapter: {
        getJwks: async _ctx => {
          void _ctx;
          const keys = await prismaAny.jwks.findMany();
          return keys.map((key: any) => ({
            ...key,
            alg: key.alg ?? undefined,
            crv: key.crv ?? undefined,
            expiresAt: key.expiresAt ?? undefined,
          })) as any;
        },
        createJwk: async (data, _ctx) => {
          void _ctx;
          const kid = deriveDeterministicKid(data.publicKey);
          const record = await prismaAny.jwks.upsert({
            where: {id: kid},
            update: {
              publicKey: data.publicKey,
              privateKey: data.privateKey,
              createdAt: data.createdAt,
              expiresAt: data.expiresAt ?? null,
              alg: data.alg ?? null,
              crv: data.crv ?? null,
            },
            create: {
              id: kid,
              publicKey: data.publicKey,
              privateKey: data.privateKey,
              createdAt: data.createdAt,
              expiresAt: data.expiresAt ?? null,
              alg: data.alg ?? null,
              crv: data.crv ?? null,
            },
          });

          return {
            ...record,
            alg: record.alg ?? undefined,
            crv: record.crv ?? undefined,
            expiresAt: record.expiresAt ?? undefined,
          } as any;
        },
      },
      jwt: {
        issuer: authIssuer,
        audience: authAudience,
        expirationTime: `${authJwtTtlSeconds}s`,
        definePayload: ({user}: {user: Record<string, unknown> & {id: string; slug?: string}}) => ({
          unitId: user.id,
          slug: user.slug,
          scope: 'user',
        }),
        getSubject: ({user}: {user: {id: string}}) => user.id,
      },
    }),
    oauthProvider({
      scopes: ['openid', 'profile', 'email', 'offline_access', 'user'],
      loginPage: '/login',
      consentPage: '/consent',
      grantTypes: ['authorization_code', 'refresh_token', 'client_credentials'],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: false,
      accessTokenExpiresIn: authJwtTtlSeconds,
      idTokenExpiresIn: authJwtTtlSeconds,
      refreshTokenExpiresIn: 60 * 60 * 24 * 30,
      authorizationResponseIssParameterSupported: true,
      disableJwtPlugin: false,
      disableSignOutSessionOnRevocation: true,
      userInfo: ({
        user,
      }: {
        user: {id: string; email: string; emailVerified: boolean; name: string};
      }) => ({
        sub: user.id,
        email: user.email,
        email_verified: user.emailVerified,
        name: user.name,
      }),
      clientPrivileges: ({action, headers}) => {
        if (action !== 'create' && action !== 'update') {
          return true;
        }

        const klass = headers.get('x-rezics-client-class') ?? 'public';
        if (klass === 'trusted') {
          return headers.get('x-rezics-internal') === '1';
        }

        if (klass === 'confidential') {
          return true;
        }

        return klass === 'public';
      },
      shouldSkipConsent: ({client}: {client: {type?: string; public?: boolean; skipConsent?: boolean}}) => {
        const clientType = client.type ?? (client.public ? 'public' : 'confidential');
        return clientType === 'trusted' || Boolean(client.skipConsent);
      },
      endSessionEndpoint: {
        enabled: true,
      },
    }),
  ],
});
