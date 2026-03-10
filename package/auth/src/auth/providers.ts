import {env} from '../env';

type SupportedProviderId = 'google' | 'microsoft' | 'github' | 'twitter';

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

export function listEnabledSocialProviderIds(): SupportedProviderId[] {
  return getConfiguredSocialProviders()
    .filter(provider => provider.enabled)
    .map(provider => provider.id);
}
