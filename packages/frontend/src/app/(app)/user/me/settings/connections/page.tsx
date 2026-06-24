"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | Connections                   |
 * | Manage linked third-party...  |
 * |-------------------------------|
 * | [Card: Connections]           |
 * | GitHub             [Connect ] |
 * | Google             [Connect ] |
 * | Discord            [Connect ] |
 * +-------------------------------+
 * 每行: flex row, provider name flex-1, button shrink-0。
 *
 * Tablet (640-1023px):
 * 与 Mobile 一致。
 *
 * Desktop (1024-1535px):
 * 受 settings layout flex-1 约束，
 * 卡片 w-full。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 */

export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly connected: boolean;
}

const defaultProviders: Provider[] = [
  { id: "github", name: "GitHub", connected: false },
  { id: "google", name: "Google", connected: false },
  { id: "discord", name: "Discord", connected: false },
];

export function SettingsConnectionsContent({
  initialProviders = defaultProviders,
}: {
  readonly initialProviders?: Provider[];
} = {}) {
  const [t] = useT();
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleToggle(providerId: string) {
    setBusy(providerId);
    try {
      // OAuth connection flow handled by auth provider in a future iteration
      // OAuth 关联流程将在后续迭代中由认证提供方处理
      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId ? { ...p, connected: !p.connected } : p,
        ),
      );
      toast.success({ title: t.settings.saved });
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t.settings.connections}</h2>
        <p className="text-muted-foreground text-sm">
          {t.settings.connectionsDescription}
        </p>
      </div>

      <Card>
        <CardHeader title={t.settings.connections} />
        <CardContent className="space-y-3">
          {providers.map((provider) => (
            <div className="flex items-center gap-3" key={provider.id}>
              <span className="min-w-0 flex-1 text-sm font-medium">
                {provider.name}
              </span>
              <Button
                className="shrink-0"
                isLoading={busy === provider.id}
                onClick={() => handleToggle(provider.id)}
                size="sm"
                variant={provider.connected ? "outline" : "default"}
              >
                {provider.connected
                  ? t.settings.disconnect
                  : t.settings.connect}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsConnectionsPage() {
  return <SettingsConnectionsContent />;
}
