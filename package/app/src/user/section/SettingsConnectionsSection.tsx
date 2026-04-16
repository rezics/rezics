import { CircularProgress, Divider, Typography } from '@mui/material';
import { authQueries } from '@rezics/api/auth/auth.queries';
import { authApi } from '@rezics/api/auth/auth.api';
import type { AuthProvider } from '@rezics/contract';
import { useQuery } from '@tanstack/react-query';
import { type FC, useState } from 'react';
import { SettingsSection } from '@/user/component/SettingsSection';
import { ProviderCard } from '@/user/component/ProviderCard';
import { providerIcons } from '@/user/component/providerIcons';
import { useRequireAuth } from '@/user/page/useAuth';

const PROVIDERS: { id: AuthProvider['id']; name: string }[] = [
  { id: 'google', name: 'Google' },
  { id: 'github', name: 'GitHub' },
  { id: 'microsoft', name: 'Microsoft' },
  { id: 'twitter', name: 'X (Twitter)' },
  { id: 'telegram', name: 'Telegram' },
];

export const SettingsConnectionsSection: FC = () => {
  useRequireAuth();

  const { data: sessionState, isLoading } = useQuery(
    authQueries.sessionState(),
  );
  const [connecting, setConnecting] = useState<AuthProvider['id'] | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <CircularProgress />
      </div>
    );
  }

  const authSession = sessionState?.authSession;
  const connectedProviders = new Set(authSession?.providerIds ?? []);
  const primaryProvider = authSession?.primaryProviderId;

  const handleConnect = async (providerId: AuthProvider['id']) => {
    setConnecting(providerId);
    try {
      const response = await authApi.signInSocial({
        provider: providerId,
        callbackURL: window.location.href,
      });
      if (response.url) {
        window.location.href = response.url;
      }
    } finally {
      setConnecting(null);
    }
  };

  return (
    <SettingsSection
      title="Connected Accounts"
      description="Link your social accounts for easier sign-in."
      divider={false}
    >
      {PROVIDERS.map((provider, i) => (
        <div key={provider.id}>
          {i > 0 && <Divider />}
          <ProviderCard
            providerId={provider.id}
            name={provider.name}
            icon={providerIcons[provider.id]}
            connected={connectedProviders.has(provider.id)}
            isPrimary={primaryProvider === provider.id}
            onConnect={() => handleConnect(provider.id)}
            connecting={connecting === provider.id}
          />
        </div>
      ))}
    </SettingsSection>
  );
};
