import type {GenericOAuthConfig} from 'better-auth/plugins';
import {createRemoteJWKSet, jwtVerify} from 'jose';
import {env} from '../env';

type SupportedProviderId =
  | 'google'
  | 'microsoft'
  | 'github'
  | 'twitter'
  | 'telegram';

type ProviderRecord = {
  id: SupportedProviderId;
  enabled: boolean;
  config?: {
    clientId: string;
    clientSecret: string;
  };
};

function providerConfig(
  id: SupportedProviderId,
  clientId: string | undefined,
  clientSecret: string | undefined,
): ProviderRecord {
  if (!clientId || !clientSecret) {
    return {
      id,
      enabled: false,
    };
  }

  return {
    id,
    enabled: true,
    config: {
      clientId,
      clientSecret,
    },
  };
}

const telegramIssuer = 'https://oauth.telegram.org';
const telegramJwks = createRemoteJWKSet(
  new URL(`${telegramIssuer}/.well-known/jwks.json`),
);

type TelegramIdTokenClaims = {
  sub?: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  phone_number?: string;
};

export function getConfiguredSocialProviders(): ProviderRecord[] {
  return [
    providerConfig('google', env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
    providerConfig(
      'microsoft',
      env.MICROSOFT_CLIENT_ID,
      env.MICROSOFT_CLIENT_SECRET,
    ),
    providerConfig('github', env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
    providerConfig('twitter', env.TWITTER_CLIENT_ID, env.TWITTER_CLIENT_SECRET),
    providerConfig(
      'telegram',
      env.TELEGRAM_CLIENT_ID,
      env.TELEGRAM_CLIENT_SECRET,
    ),
  ];
}

export function buildSocialProviderOptions() {
  const providers = getConfiguredSocialProviders();

  return {
    google: providers.find(provider => provider.id === 'google')?.config,
    microsoft: providers.find(provider => provider.id === 'microsoft')?.config,
    github: providers.find(provider => provider.id === 'github')?.config,
    twitter: providers.find(provider => provider.id === 'twitter')?.config,
  };
}

export function getTelegramGenericOAuthConfig():
  | GenericOAuthConfig
  | undefined {
  const telegram = getConfiguredSocialProviders().find(
    provider => provider.id === 'telegram',
  );

  const telegramConfig = telegram?.config;

  if (!telegramConfig) {
    return undefined;
  }

  return {
    providerId: 'telegram',
    discoveryUrl: `${telegramIssuer}/.well-known/openid-configuration`,
    issuer: telegramIssuer,
    clientId: telegramConfig.clientId,
    clientSecret: telegramConfig.clientSecret,
    scopes: ['openid', 'profile'],
    pkce: true,
    getUserInfo: async tokens => {
      if (!tokens.idToken) {
        return null;
      }

      const {payload} = await jwtVerify<TelegramIdTokenClaims>(
        tokens.idToken,
        telegramJwks,
        {
          issuer: telegramIssuer,
          audience: telegramConfig.clientId,
        },
      );

      const subject =
        typeof payload.sub === 'string' && payload.sub.length > 0
          ? payload.sub
          : undefined;

      if (!subject) {
        return null;
      }

      return {
        id: subject,
        name:
          typeof payload.name === 'string' && payload.name.length > 0
            ? payload.name
            : typeof payload.preferred_username === 'string' &&
                payload.preferred_username.length > 0
              ? payload.preferred_username
              : 'Telegram User',
        image: typeof payload.picture === 'string' ? payload.picture : undefined,
        emailVerified: false,
      };
    },
  };
}

export function listEnabledSocialProviderIds(): SupportedProviderId[] {
  return getConfiguredSocialProviders()
    .filter(provider => provider.enabled)
    .map(provider => provider.id);
}
