import type { CreateApiTokenInput } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
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
import { useState } from "react";
import { ScopesEditor } from "./ScopesEditor";

interface CreateTokenDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateApiTokenInput) => Promise<void>;
  creating: boolean;
  error: string | null;
}

/**
 * CreateTokenDialog - 创建新 API token 的对话框
 */
export const CreateTokenDialog: FC<CreateTokenDialogProps> = ({
  open,
  onClose,
  onCreate,
  creating,
  error,
}) => {
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [scopes, setScopes] = useState<Record<string, string[]>>({});

  const handleCreate = async () => {
    const input: CreateApiTokenInput = {
      name: name || m.admin_token_default_name(),
      ...(expiresAt ? { expiresAt } : {}),
      ...(Object.keys(scopes).length > 0 ? { scopes } : {}),
    };
    await onCreate(input);
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
          <DialogTitle>{m.admin_token_create_dialog_title()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ctd-name">{m.admin_token_token_name()}</Label>
            <Input
              id="ctd-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ctd-exp">
              {m.admin_token_expires_at_optional()}
            </Label>
            <Input
              id="ctd-exp"
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
            {m.common_cancel()}
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? m.admin_token_creating() : m.common_create()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTokenDialog;
