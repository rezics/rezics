import { useTranslation } from "@rezics/i18n/react";
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { Copy as ContentCopyIcon } from "lucide-react";
import type { FC } from "react";

interface TokenSecretDialogProps {
  open: boolean;
  secret: string | null;
  onClose: () => void;
}

/**
 * TokenSecretDialog - shows the newly created token secret (displayed only once).
 * TokenSecretDialog - 显示新创建的 token secret（仅显示一次）
 */
export const TokenSecretDialog: FC<TokenSecretDialogProps> = ({
  open,
  secret,
  onClose,
}) => {
  const { t } = useTranslation(["admin", "common"]);
  const copyToClipboard = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
    } catch (_) {
      // Intentionally ignore clipboard write failures.
      // 有意忽略剪贴板写入失败。
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin:token_created_secret_title")}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <Alert>
            <AlertDescription className="text-warning-text">
              {t("admin:token_created_secret_description")}
            </AlertDescription>
          </Alert>

          <div className="mt-4 flex items-center justify-between gap-2">
            <pre className="text-sm font-mono whitespace-pre-wrap break-all flex-1">
              {secret}
            </pre>
            <Button
              variant="ghost"
              size="icon"
              onClick={copyToClipboard}
              aria-label={t("common:copy_link")}
            >
              <ContentCopyIcon className="size-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("common:close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TokenSecretDialog;
