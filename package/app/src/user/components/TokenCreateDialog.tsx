import { useCreateTokenMutation } from "@rezics/api/token/token.mutations";
import type { ApiTokenScopes } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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
} from "@rezics/ui/shadcn";
import { Check as CheckIcon, Copy as ContentCopyIcon } from "lucide-react";
import { type FC, useState } from "react";

const AVAILABLE_SCOPES = [
  { domain: "user", perm: "read", label: "user:read" },
  { domain: "user", perm: "write", label: "user:write" },
  {
    domain: "dispatch",
    perm: "rezics-server-session",
    label: "dispatch:rezics-server-session",
  },
] as const;

interface TokenCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export const TokenCreateDialog: FC<TokenCreateDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation(["common", "settings"]);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState("");
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createToken = useCreateTokenMutation();

  const handleToggleScope = (label: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const handleCreate = () => {
    const scopes: ApiTokenScopes = {};
    for (const s of AVAILABLE_SCOPES) {
      if (selectedScopes.has(s.label)) {
        if (!scopes[s.domain]) scopes[s.domain] = [];
        scopes[s.domain].push(s.perm);
      }
    }

    createToken.mutate(
      {
        name,
        scopes: Object.keys(scopes).length > 0 ? scopes : undefined,
        expiresAt: expiresAt || undefined,
      },
      {
        onSuccess: (data) => {
          setRawToken(data.token);
        },
      },
    );
  };

  const handleCopy = async () => {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName("");
    setSelectedScopes(new Set());
    setExpiresAt("");
    setRawToken(null);
    setCopied(false);
    createToken.reset();
    onClose();
  };

  if (rawToken) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t("settings:tokens_created_title")}</DialogTitle>
          </DialogHeader>
          <Alert className="mb-4 text-warning-text">
            <AlertDescription>
              {t("settings:tokens_created_warning")}
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2 p-3 rounded bg-surface-subtle font-mono text-sm break-all">
            <span className="flex-1">{rawToken}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleCopy}
              aria-label={t("settings:tokens_copy")}
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-success-text" />
              ) : (
                <ContentCopyIcon className="w-4 h-4" />
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>{t("common:done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t("settings:tokens_generate")}</DialogTitle>
        </DialogHeader>
        {createToken.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{createToken.error.message}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token-name">
              {t("settings:tokens_name_label")}
            </Label>
            <Input
              id="token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={t("settings:tokens_name_placeholder")}
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">{t("common:scopes")}</p>
            <div className="flex flex-col gap-2">
              {AVAILABLE_SCOPES.map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedScopes.has(s.label)}
                    onCheckedChange={() => handleToggleScope(s.label)}
                    aria-label={s.label}
                  />
                  <span className="text-sm">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token-expiry">
              {t("settings:tokens_expiration_optional")}
            </Label>
            <Input
              id="token-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            {t("common:cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name || createToken.isPending}
          >
            {createToken.isPending
              ? t("common:creating")
              : t("settings:tokens_generate_action")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
