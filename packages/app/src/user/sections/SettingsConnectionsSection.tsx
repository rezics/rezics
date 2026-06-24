import { authApi } from "@rezics/api/auth/auth.api";
import { authQueries } from "@rezics/api/auth/auth.queries";
import type { AuthProvider } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { ProviderCard } from "@/user/components/ProviderCard";
import { providerIcons } from "@/user/components/providerIcons";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

const PROVIDERS: { id: AuthProvider["id"]; name: string }[] = [
  { id: "google", name: "Google" },
  { id: "github", name: "GitHub" },
  { id: "microsoft", name: "Microsoft" },
  { id: "twitter", name: "X (Twitter)" },
  { id: "telegram", name: "Telegram" },
];

/**
 * 连接部分：显示已连接和可连接的社交提供商（Google、GitHub、Microsoft、X、Telegram）。
 * 用户可以连接新的提供商以用于登录和身份验证，指定主要提供商，并管理多个账户连接。
 *
 * Desktop (≥1024px):
 * ┌─────────────────────────────────────┐
 * │ Connected Accounts                  │
 * │ [Google Icon] Google                │
 * │ [Connected]        [Remove]         │
 * │ ─────────────────────────────────   │
 * │ [GitHub Icon] GitHub                │
 * │ [Connect]                           │
 * │ ─────────────────────────────────   │
 * │ [Microsoft Icon] Microsoft          │
 * │ [Connect]                           │
 * └─────────────────────────────────────┘
 *
 * Tablet (768px-1023px):
 * ┌──────────────────────────────┐
 * │ Connected Accounts           │
 * │ [Google] Connected           │
 * │ [Remove]                     │
 * │ ──────────────────────────   │
 * │ [GitHub] [Connect]           │
 * │ ──────────────────────────   │
 * │ [Microsoft] [Connect]        │
 * └──────────────────────────────┘
 *
 * Mobile (480px-767px):
 * ┌──────────────────┐
 * │Connections      │
 * │[G] Google        │
 * │Connected         │
 * │[Remove]          │
 * │─────────────────│
 * │[H] GitHub        │
 * │[Connect]         │
 * │─────────────────│
 * │[M] Microsoft     │
 * │[Connect]         │
 * └──────────────────┘
 *
 * Small Mobile (<480px):
 * ┌──────────┐
 * │Connect   │
 * │[G]Google │
 * │Connected │
 * │[Remove]  │
 * │────────  │
 * │[H]GitHub │
 * │[Connect] │
 * │────────  │
 * │[M]MS     │
 * │[Connect] │
 * └──────────┘
 */
export const SettingsConnectionsSection: FC = () => {
  const { t } = useTranslation(["settings"]);
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
      title={t("settings:connections_title")}
      description={t("settings:connections_description")}
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
