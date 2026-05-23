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
import * as m from "@rezics/i18n/messages";

interface TokenSecretDialogProps {
  open: boolean;
  secret: string | null;
  onClose: () => void;
}

/**
 * TokenSecretDialog - 显示新创建的 token secret（仅显示一次）
 */
export const TokenSecretDialog: FC<TokenSecretDialogProps> = ({
  open,
  secret,
  onClose,
}) => {
  const copyToClipboard = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
    } catch (_) {
      // ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m.admin_token_created_secret_title()}</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <Alert>
            <AlertDescription className="text-warning-text">
              {m.admin_token_created_secret_description()}
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
              aria-label={m.common_copy_link()}
            >
              <ContentCopyIcon className="size-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {m.common_close()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TokenSecretDialog;
