import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import {Stack, Typography} from '@mui/material';
import {authApi, authQueries} from '@package/api/auth/auth.ts';
import {AuthProviderButton} from '@package/ui/composite/auth/AuthProviderButton.tsx';
import {useQuery} from '@tanstack/react-query';
import {type FC, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {buildOAuthCallbackTargets} from '../model/authRedirect';

function formatProviderLabel(providerId: string, t: (key: string, options?: any) => string): string {
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

export const SocialAuthButtons: FC<{
  mode: 'login' | 'register';
}> = ({mode}) => {
  const {t} = useTranslation();
  const [error, setError] = useState<string>();
  const [providerLoading, setProviderLoading] = useState<string>();
  const {data, isLoading} = useQuery(authQueries.providers());

  const providers = data?.providers ?? [];

  const startProviderSignIn = async (provider: (typeof providers)[number]) => {
    setError(undefined);
    setProviderLoading(provider.id);

    try {
      const origin =
        typeof window === 'undefined' ? '' : window.location.origin;
      const callbackTargets = buildOAuthCallbackTargets(origin, mode);
      const response = await authApi.signInSocial({
        provider: provider.id,
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

  if (isLoading) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('auth.flow.providers_loading')}
      </Typography>
    );
  }

  if (providers.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Divider>{t('auth.flow.providers_divider')}</Divider>
      {error && <Alert severity="error">{error}</Alert>}
      <Stack spacing={1}>
        {providers.map(provider => (
          <AuthProviderButton
            key={provider.id}
            loading={providerLoading === provider.id}
            disabled={Boolean(providerLoading && providerLoading !== provider.id)}
            label={t('auth.flow.continue_with_provider', {
              provider: formatProviderLabel(provider.id, t),
            })}
            onClick={() => void startProviderSignIn(provider)}
          />
        ))}
      </Stack>
    </Stack>
  );
};
