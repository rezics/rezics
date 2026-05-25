import { authApi, authQueries } from "@rezics/api/auth/auth";
import type { AuthProvider } from "@rezics/contract";
import { AuthProviderButton } from "@rezics/ui/composite/auth/AuthProviderButton.tsx";
import {
  Alert,
  AlertDescription,
  Separator,
  Skeleton,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { type FC, useMemo, useState } from "react";
import { buildOAuthCallbackTargets } from "../models/authRedirect";
import { providerIcons } from "./providerIcons";
import {
  auth_flow_continue_with_provider,
  auth_flow_providers_divider,
  auth_flow_providers_github,
  auth_flow_providers_google,
  auth_flow_providers_microsoft,
  auth_flow_providers_telegram,
  auth_flow_providers_twitter,
} from "@rezics/i18n/messages";

// TODO 横条文字应该居中一点，更美观

function formatProviderLabel(providerId: string): string {
  switch (providerId) {
    case "github":
      return auth_flow_providers_github();
    case "google":
      return auth_flow_providers_google();
    case "microsoft":
      return auth_flow_providers_microsoft();
    case "telegram":
      return auth_flow_providers_telegram();
    case "twitter":
      return auth_flow_providers_twitter();
    default:
      return providerId;
  }
}

const FEATURED_COUNT = 2;

const OPTIMISTIC_PROVIDER: AuthProvider = {
  id: "google",
  enabled: true,
};

export const SocialAuthButtons: FC<{
  mode: "login" | "register";
}> = ({ mode }) => {
  const [error, setError] = useState<string>();
  const [providerLoading, setProviderLoading] = useState<string>();
  const { data, isLoading } = useQuery(authQueries.providers());

  const providers = useMemo(() => data?.providers ?? [], [data?.providers]);

  const { featured, compact } = useMemo(() => {
    const list = providers.length > 0 ? providers : [OPTIMISTIC_PROVIDER];
    return {
      featured: list.slice(0, FEATURED_COUNT),
      compact: list.slice(FEATURED_COUNT),
    };
  }, [providers]);

  const startProviderSignIn = async (providerId: AuthProvider["id"]) => {
    setError(undefined);
    setProviderLoading(providerId);

    try {
      const origin =
        typeof window === "undefined" ? "" : window.location.origin;
      const callbackTargets = buildOAuthCallbackTargets(origin, mode);
      const response = await authApi.signInSocial({
        provider: providerId,
        disableRedirect: true,
        callbackURL: callbackTargets.callbackURL,
        newUserCallbackURL: callbackTargets.newUserCallbackURL,
        errorCallbackURL: callbackTargets.errorCallbackURL,
      });

      if (!response.url) {
        throw new Error("Provider sign-in did not return a redirect URL.");
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
            ? formatProviderLabel(provider.id)
            : auth_flow_continue_with_provider({
                provider: formatProviderLabel(provider.id),
              })
        }
        onClick={() => void startProviderSignIn(provider.id)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex items-center">
        <Separator className="flex-1" />
        <span className="px-3 text-sm text-text-secondary">
          {auth_flow_providers_divider()}
        </span>
        <Separator className="flex-1" />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        {featured.map((p) => renderProviderButton(p, false))}
      </div>

      {isLoading && providers.length === 0 && (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-9 rounded-md" />
          <div className="grid grid-cols-2 gap-1.5">
            <Skeleton className="h-[34px] rounded-md" />
            <Skeleton className="h-[34px] rounded-md" />
          </div>
        </div>
      )}

      {compact.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {compact.map((p) => renderProviderButton(p, true))}
        </div>
      )}
    </div>
  );
};
