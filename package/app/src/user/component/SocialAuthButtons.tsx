import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import {Stack} from '@mui/material';
import {authApi, authQueries} from '@rezics/api/auth/auth';
import type {AuthProvider} from '@rezics/contract';
import {AuthProviderButton} from '@rezics/ui/composite/auth/AuthProviderButton.tsx';
import {useQuery} from '@tanstack/react-query';
import type {TFunction} from 'i18next';
import {type FC, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {buildOAuthCallbackTargets} from '../model/authRedirect';
import {providerIcons} from './providerIcons';

// TODO 横条文字应该居中一点，更美观

function formatProviderLabel(providerId: string, t: TFunction): string {
  switch (providerId) {
    case 'github':
      return t('auth.flow.providers.github');
    case 'google':
      return t('auth.flow.providers.google');
    case 'microsoft':
      return t('auth.flow.providers.microsoft');
    case 'telegram':
      return t('auth.flow.providers.telegram');
    case 'twitter':
      return t('auth.flow.providers.twitter');
    default:
      return providerId;
  }
}

const FEATURED_COUNT = 2;

const OPTIMISTIC_PROVIDER: AuthProvider = {
  id: 'google',
  enabled: true,
};

export const SocialAuthButtons: FC<{
  mode: 'login' | 'register';
}> = ({mode}) => {
  const {t} = useTranslation();
  const [error, setError] = useState<string>();
  const [providerLoading, setProviderLoading] = useState<string>();
  const {data, isLoading} = useQuery(authQueries.providers());

  const providers = useMemo(() => data?.providers ?? [], [data?.providers]);

  const {featured, compact} = useMemo(() => {
    const list = providers.length > 0 ? providers : [OPTIMISTIC_PROVIDER];
    return {
      featured: list.slice(0, FEATURED_COUNT),
      compact: list.slice(FEATURED_COUNT),
    };
  }, [providers]);

  const startProviderSignIn = async (providerId: AuthProvider['id']) => {
    setError(undefined);
    setProviderLoading(providerId);

    try {
      const origin =
        typeof window === 'undefined' ? '' : window.location.origin;
      const callbackTargets = buildOAuthCallbackTargets(origin, mode);
      const response = await authApi.signInSocial({
        provider: providerId,
        disableRedirect: true,
        callbackURL: callbackTargets.callbackURL,
        newUserCallbackURL: callbackTargets.newUserCallbackURL,
        errorCallbackURL: callbackTargets.errorCallbackURL,
      });

      if (!response.url) {
        throw new Error('Provider sign-in did not return a redirect URL.');
      }

      window.location.assign(response.url);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setProviderLoading(undefined);
    }
  };

  const renderProviderButton = (provider: AuthProvider, isCompact: boolean) => {
    const Icon = providerIcons[provider.id];
    return (
      <AuthProviderButton
        key={provider.id}
        compact={isCompact}
        icon={Icon ? <Icon size={20} /> : undefined}
        loading={providerLoading === provider.id}
        disabled={Boolean(providerLoading && providerLoading !== provider.id)}
        label={
          isCompact
            ? formatProviderLabel(provider.id, t)
            : t('auth.flow.continue_with_provider', {
                provider: formatProviderLabel(provider.id, t),
              })
        }
        onClick={() => void startProviderSignIn(provider.id)}
      />
    );
  };

  return (
    <Stack spacing={1.5}>
      <Divider>{t('auth.flow.providers_divider')}</Divider>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack spacing={1}>
        {featured.map(p => renderProviderButton(p, false))}
      </Stack>

      {isLoading && providers.length === 0 && (
        <Stack spacing={0.75}>
          <Skeleton variant="rounded" height={36} />
          <Box
            sx={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75}}
          >
            <Skeleton variant="rounded" height={34} />
            <Skeleton variant="rounded" height={34} />
          </Box>
        </Stack>
      )}

      {compact.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 0.75,
          }}
        >
          {compact.map(p => renderProviderButton(p, true))}
        </Box>
      )}
    </Stack>
  );
};
