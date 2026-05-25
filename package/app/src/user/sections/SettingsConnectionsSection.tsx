import { authApi } from "@rezics/api/auth/auth.api";
import { authQueries } from "@rezics/api/auth/auth.queries";
import type { AuthProvider } from "@rezics/contract";
import {
  settings_connections_description,
  settings_connections_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { ProviderCard } from "@/user/components/ProviderCard";
import { providerIcons } from "@/user/components/providerIcons";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

const i18nMessages = {
  settings_connections_description,
  settings_connections_title,
};

const PROVIDERS: { id: AuthProvider["id"]; name: string }[] = [
  { id: "google", name: "Google" },
  { id: "github", name: "GitHub" },
  { id: "microsoft", name: "Microsoft" },
  { id: "twitter", name: "X (Twitter)" },
  { id: "telegram", name: "Telegram" },
];

export const SettingsConnectionsSection: FC = () => {
  const m = useMessage(i18nMessages);
  useRequireAuth();

  const { data: sessionState, isLoading } = useQuery(
    authQueries.sessionState(),
  );
  const [connecting, setConnecting] = useState<AuthProvider["id"] | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const authAccountState = sessionState?.authAccountState;
  const connectedProviders = new Set(authAccountState?.providerIds ?? []);
  const primaryProvider = authAccountState?.primaryProviderId;

  const handleConnect = async (providerId: AuthProvider["id"]) => {
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
      title={m.settings_connections_title()}
      description={m.settings_connections_description()}
      divider={false}
    >
      {PROVIDERS.map((provider, i) => (
        <div key={provider.id}>
          {i > 0 && <Separator />}
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
