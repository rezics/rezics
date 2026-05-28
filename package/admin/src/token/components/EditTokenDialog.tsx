import type { ApiTokenDTO, UpdateApiTokenInput } from "@rezics/contract";
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
  Input,
  Label,
} from "@rezics/ui/shadcn";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { ScopesEditor } from "./ScopesEditor";

interface EditTokenDialogProps {
  open: boolean;
  token: ApiTokenDTO | null;
  onClose: () => void;
  onUpdate: (id: string, input: UpdateApiTokenInput) => Promise<void>;
  updating: boolean;
  error: string | null;
}

/**
 * EditTokenDialog - 编辑 API token 的对话框（更新名称、权限、过期时间等）
 */
export const EditTokenDialog: FC<EditTokenDialogProps> = ({
  open,
  token,
  onClose,
  onUpdate,
  updating,
  error,
}) => {
  const { t } = useTranslation(["admin", "common"]);
const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [scopes, setScopes] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (token) {
      setName(token.name);
      // 处理 expiresAt 为 datetime-local 格式
      if (token.expiresAt) {
        const date = new Date(token.expiresAt);
        // 格式化为 datetime-local 输入格式: YYYY-MM-DDTHH:mm
        const formatted = date.toISOString().slice(0, 16);
        setExpiresAt(formatted);
      } else {
        setExpiresAt("");
      }
      setScopes(token.scopes ?? {});
    }
  }, [token]);

  const handleUpdate = async () => {
    if (!token) return;

    const input: UpdateApiTokenInput = {
      name: name || token.name,
      scopes,
      expiresAt: expiresAt || null,
    };
    await onUpdate(token.id, input);
  };

  const handleClose = () => {
    setName("");
    setExpiresAt("");
    setScopes({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin:token_edit_dialog_title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="etd-name">{t("admin:token_token_name")}</Label>
            <Input
              id="etd-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="etd-exp">
              {t("admin:token_expires_at_optional")}
            </Label>
            <Input
              id="etd-exp"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <ScopesEditor scopes={scopes} onChange={setScopes} />
          {error && (
            <Alert>
              <AlertDescription className="text-error-text">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t("common:cancel")}
          </Button>
          <Button onClick={handleUpdate} disabled={updating}>
            {updating ? t("admin:token_updating") : t("common:update")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTokenDialog;
