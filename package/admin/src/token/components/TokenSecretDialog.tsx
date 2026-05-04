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
          <DialogTitle>Token Created — Copy & Store</DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <Alert>
            <AlertDescription className="text-warning-text">
              This token value is only shown once. Be sure to copy and store it
              securely.
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
              aria-label="Copy"
            >
              <ContentCopyIcon className="size-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TokenSecretDialog;
