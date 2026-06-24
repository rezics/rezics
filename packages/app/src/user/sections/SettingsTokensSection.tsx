import {
  useRevokeTokenMutation,
  useUpdateTokenMutation,
} from "@rezics/api/token/token.mutations";
import { tokenQueries } from "@rezics/api/token/token.queries";
import type { ApiTokenDTO, ApiTokenScopes } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Plus as AddIcon } from "lucide-react";
import { type FC, useState } from "react";
import { SettingsSection } from "@/user/components/SettingsSection";
import { TokenCreateDialog } from "@/user/components/TokenCreateDialog";
import { TokenListItem } from "@/user/components/TokenListItem";
import { useRequireAuth } from "@/user/pages/useAuth";

const AVAILABLE_SCOPES = [
  { domain: "user", perm: "read", label: "user:read" },
  { domain: "user", perm: "write", label: "user:write" },
  {
    domain: "dispatch",
    perm: "rezics-server-session",
    label: "dispatch:rezics-server-session",
  },
] as const;

/**
 * API 令牌部分：管理个人 API 令牌用于程序化访问。
 * 用户可以生成新令牌、编辑令牌名称和作用域、设置过期日期，以及撤销不再需要的令牌。
 *
 * Desktop (≥1024px):
 * ┌─────────────────────────────────────┐
 * │ API Tokens                          │
 * │ [+ Generate Token]                  │
 * │                                     │
 * │ Token Name • Created Last Used      │
 * │ user:read user:write          Edit  │
 * │ [Revoke]                           │
 * │ ────────────────────────────────    │
 * │ Server Token • Created 2 days ago   │
 * │ user:read       Expires 2026-12-31 │
 * │ [Revoke]                           │
 * │                                     │
 * │ Create Token Dialog                 │
 * │ [Token Name] [Scope Checkboxes]     │
 * │ [Expiration Date] [Create]          │
 * │                                     │
 * │ Edit Token Dialog                   │
 * │ [Token Name] [Scope Checkboxes]     │
 * │ [Expiration Date] [Save]            │
 * │                                     │
 * │ Revoke Confirmation Dialog          │
 * │ Are you sure? [Cancel] [Revoke]     │
 * └─────────────────────────────────────┘
 *
 * Tablet (768px-1023px):
 * ┌──────────────────────────────┐
 * │ API Tokens                   │
 * │ [+ Generate Token]           │
 * │                              │
 * │ Token Name                   │
 * │ Scopes: user:read, user:write
 * │ [Edit] [Revoke]              │
 * │ ──────────────────────────── │
 * │ Server Token                 │
 * │ Expires: 2026-12-31          │
 * │ [Edit] [Revoke]              │
 * │                              │
 * │ Create Token Dialog          │
 * │ [Token Name]                 │
 * │ [Scopes]                     │
 * │ [Expiration] [Create]        │
 * └──────────────────────────────┘
 *
 * Mobile (480px-767px):
 * ┌──────────────────┐
 * │API Tokens        │
 * │[+ Generate]      │
 * │                  │
 * │Token Name        │
 * │Scopes: user:read │
 * │user:write        │
 * │[Edit] [Revoke]   │
 * │─────────────────│
 * │Server Token      │
 * │Expires 2026-12-31
 * │[Edit] [Revoke]   │
 * │                  │
 * │Create Dialog     │
 * │[Token Name]      │
 * │[Scopes]          │
 * │[Date] [Create]   │
 * └──────────────────┘
 *
 * Small Mobile (<480px):
 * ┌──────────┐
 * │API Toks  │
 * │[+Gen]    │
 * │          │
 * │Token1    │
 * │user:read │
 * │[E][Rev]  │
 * │────────  │
 * │Token2    │
 * │user:rw   │
 * │[E][Rev]  │
 * │          │
 * │[Create]  │
 * │[Name]    │
 * │[Scopes]  │
 * │[Create]  │
 * └──────────┘
 */
export const SettingsTokensSection: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();

  const { data, isLoading } = useQuery(tokenQueries.list());
  const updateToken = useUpdateTokenMutation();
  const revokeToken = useRevokeTokenMutation();

  const [createOpen, setCreateOpen] = useState(false);
  const [editToken, setEditToken] = useState<ApiTokenDTO | null>(null);
  const [editName, setEditName] = useState("");
  const [editScopes, setEditScopes] = useState<Set<string>>(new Set());
  const [editExpiry, setEditExpiry] = useState("");
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const tokens = data?.tokens?.filter((t) => !t.revoked) ?? [];

  const handleStartEdit = (token: ApiTokenDTO) => {
    setEditToken(token);
    setEditName(token.name);
    setEditScopes(scopesToSet(token.scopes));
    setEditExpiry(
      token.expiresAt
        ? new Date(token.expiresAt).toISOString().split("T")[0]
        : "",
    );
  };

  const handleSaveEdit = () => {
    if (!editToken) return;
    updateToken.mutate(
      {
        id: editToken.id,
        input: {
          name: editName,
          scopes: setToScopes(editScopes),
          expiresAt: editExpiry || null,
        },
      },
      { onSuccess: () => setEditToken(null) },
    );
  };

  const handleToggleEditScope = (label: string) => {
    setEditScopes((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleConfirmRevoke = () => {
    if (!revokeId) return;
    revokeToken.mutate(revokeId, {
      onSuccess: () => setRevokeId(null),
    });
  };

  return (
    <div>
      <SettingsSection
        title={t("settings:tokens_title")}
        description={t("settings:tokens_description")}
        divider={false}
      >
        <div className="mb-4">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <AddIcon className="w-4 h-4 mr-1" />
            {t("settings:tokens_generate")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : tokens.length > 0 ? (
          <div>
            {tokens.map((token, i) => (
              <div key={token.id}>
                {i > 0 && <Separator />}
                <TokenListItem
                  token={token}
                  onEdit={handleStartEdit}
                  onRevoke={setRevokeId}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            {t("settings:tokens_empty")}
          </p>
        )}
      </SettingsSection>

      <TokenCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Edit dialog — 编辑对话框 */}
      <Dialog open={!!editToken} onOpenChange={(o) => !o && setEditToken(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t("settings:tokens_edit_title")}</DialogTitle>
          </DialogHeader>
          {updateToken.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{updateToken.error.message}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-token-name">
                {t("settings:tokens_name_label")}
              </Label>
              <Input
                id="edit-token-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">{t("common:scopes")}</p>
              <div className="flex flex-col gap-2">
                {AVAILABLE_SCOPES.map((s) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <Checkbox
                      checked={editScopes.has(s.label)}
                      onCheckedChange={() => handleToggleEditScope(s.label)}
                      aria-label={s.label}
                    />
                    <span className="text-sm">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-token-expiry">
                {t("settings:tokens_expiration_date")}
              </Label>
              <Input
                id="edit-token-expiry"
                type="date"
                value={editExpiry}
                onChange={(e) => setEditExpiry(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditToken(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editName || updateToken.isPending}
            >
              {updateToken.isPending ? t("common:saving") : t("common:save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog — 撤销确认对话框 */}
      <Dialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings:tokens_revoke_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{t("settings:tokens_revoke_description")}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeId(null)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRevoke}
              disabled={revokeToken.isPending}
            >
              {revokeToken.isPending
                ? t("settings:tokens_revoking")
                : t("common:revoke")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function scopesToSet(scopes?: Record<string, string[]>): Set<string> {
  if (!scopes) return new Set();
  const set = new Set<string>();
  for (const [domain, perms] of Object.entries(scopes)) {
    for (const p of perms) set.add(`${domain}:${p}`);
  }
  return set;
}

function setToScopes(set: Set<string>): ApiTokenScopes {
  const scopes: ApiTokenScopes = {};
  for (const label of set) {
    const [domain, ...rest] = label.split(":");
    const perm = rest.join(":");
    if (!scopes[domain]) scopes[domain] = [];
    scopes[domain].push(perm);
  }
  return scopes;
}
