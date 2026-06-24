"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { useT } from "@/lib/i18n/locale";

/**
 * Mobile (<640px):
 * +-------------------------------+
 * | API Tokens                    |
 * | Create and manage...          |
 * |-------------------------------|
 * | [Card: Create Token]          |
 * | Token Name  [input          ] |
 * |              [Create Token  ] |
 * |-------------------------------|
 * | [Card: Existing Tokens]       |
 * | "My bot"      Never   [Rev ] |
 * | "CI key"      Never   [Rev ] |
 * | -- or --                      |
 * | No API tokens yet.            |
 * +-------------------------------+
 * token 行: flex row, name flex-1 truncate,
 * meta shrink-0, button shrink-0。
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

export interface Token {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly lastUsed: string | null;
}

export function SettingsTokensContent({
  initialTokens = [],
}: {
  readonly initialTokens?: Token[];
} = {}) {
  const [t] = useT();
  const [tokenName, setTokenName] = useState("");
  const [tokens, setTokens] = useState<Token[]>(initialTokens);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!tokenName.trim()) return;
    setCreating(true);
    try {
      // Token creation via API in a future iteration
      // 令牌创建将在后续迭代中通过 API 实现
      const newToken: Token = {
        id: crypto.randomUUID(),
        name: tokenName.trim(),
        createdAt: new Date().toISOString(),
        lastUsed: null,
      };
      setTokens((prev) => [newToken, ...prev]);
      setTokenName("");
      toast.success({ title: t.settings.tokenCreated });
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      // Token revocation via API in a future iteration
      // 令牌撤销将在后续迭代中通过 API 实现
      setTokens((prev) => prev.filter((tk) => tk.id !== id));
      toast.success({ title: t.settings.tokenRevoked });
    } catch {
      toast.error({ title: t.common.error });
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t.settings.tokens}</h2>
        <p className="text-muted-foreground text-sm">
          {t.settings.tokensDescription}
        </p>
      </div>

      <Card>
        <form className="flex min-h-0 flex-col" onSubmit={handleCreate}>
          <CardHeader title={t.settings.createToken} />
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="settings-tokenName"
              >
                {t.settings.tokenName}
              </label>
              <Input
                id="settings-tokenName"
                onChange={(e) => setTokenName(e.target.value)}
                placeholder={t.settings.tokenNamePlaceholder}
                value={tokenName}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button isLoading={creating} type="submit">
              {t.settings.createToken}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader title={t.settings.tokens} />
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t.settings.noTokens}
            </p>
          ) : (
            <div className="space-y-3">
              {tokens.map((token) => (
                <div className="flex items-center gap-3" key={token.id}>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {token.name}
                  </span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {token.lastUsed ?? t.settings.neverUsed}
                  </span>
                  <Button
                    className="shrink-0"
                    isLoading={revokingId === token.id}
                    onClick={() => handleRevoke(token.id)}
                    size="sm"
                    variant="destructive"
                  >
                    {t.settings.revokeToken}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsTokensPage() {
  return <SettingsTokensContent />;
}
