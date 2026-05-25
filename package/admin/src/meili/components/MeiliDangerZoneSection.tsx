import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
} from "@rezics/ui/shadcn";
import { useMessage } from "@rezics/i18n/react";
import {
  admin_meili_dangerous_operations_description,
  admin_meili_dangerous_operations_title,
  admin_meili_delete_all_documents_description,
  admin_meili_delete_all_documents_title,
  admin_meili_delete_all_indexes,
  admin_meili_reset_dialog_description,
  admin_meili_reset_dialog_title,
  admin_meili_reset_everything_description,
  admin_meili_reset_everything_title,
  admin_meili_reset_type_to_confirm_prefix,
  admin_meili_reset_type_to_confirm_suffix,
  admin_meili_resetting,
  common_cancel,
} from "@rezics/i18n/messages";
const m = {
  admin_meili_dangerous_operations_description,
  admin_meili_dangerous_operations_title,
  admin_meili_delete_all_documents_description,
  admin_meili_delete_all_documents_title,
  admin_meili_delete_all_indexes,
  admin_meili_reset_dialog_description,
  admin_meili_reset_dialog_title,
  admin_meili_reset_everything_description,
  admin_meili_reset_everything_title,
  admin_meili_reset_type_to_confirm_prefix,
  admin_meili_reset_type_to_confirm_suffix,
  admin_meili_resetting,
  common_cancel,
};

const i18nMessages = {
  admin_meili_dangerous_operations_description,
  admin_meili_dangerous_operations_title,
  admin_meili_delete_all_documents_description,
  admin_meili_delete_all_documents_title,
  admin_meili_delete_all_indexes,
  admin_meili_reset_dialog_description,
  admin_meili_reset_dialog_title,
  admin_meili_reset_everything_description,
  admin_meili_reset_everything_title,
  admin_meili_reset_type_to_confirm_prefix,
  admin_meili_reset_type_to_confirm_suffix,
  admin_meili_resetting,
  common_cancel,
};

export interface MeiliDangerAction {
  id: string;
  label: string;
  pendingLabel: string;
  confirmLabel: string;
  isPending: boolean;
  onConfirm: () => void;
}

const RESET_CONFIRMATION_TOKEN = "RESET";

export function MeiliDangerZoneSection({
  deleteActions,
  resetDialogOpen,
  resetConfirmText,
  isResetPending,
  onResetDialogOpenChange,
  onResetConfirmTextChange,
  onReset,
}: {
  deleteActions: MeiliDangerAction[];
  resetDialogOpen: boolean;
  resetConfirmText: string;
  isResetPending: boolean;
  onResetDialogOpenChange: (open: boolean) => void;
  onResetConfirmTextChange: (value: string) => void;
  onReset: () => void;
}) {
  const m = useMessage(i18nMessages);
  return (
    <>
      <Card className="border-border-whisper bg-surface-base">
        <CardHeader>
          <CardTitle>{m.admin_meili_dangerous_operations_title()}</CardTitle>
          <CardDescription>
            {m.admin_meili_dangerous_operations_description()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-semibold leading-[1.4]">
              {m.admin_meili_delete_all_documents_title()}
            </p>
            <p className="mb-2 block text-xs leading-[1.4] text-text-secondary">
              {m.admin_meili_delete_all_documents_description()}
            </p>
            <div className="flex flex-wrap gap-2">
              {deleteActions.map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  variant="outline"
                  className="text-error-text"
                  onClick={() => {
                    const ok = window.confirm(action.confirmLabel);
                    if (!ok) return;
                    action.onConfirm();
                  }}
                  disabled={action.isPending}
                >
                  {action.isPending ? action.pendingLabel : action.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-1 text-sm font-semibold leading-[1.4] text-error-text">
              {m.admin_meili_reset_everything_title()}
            </p>
            <p className="mb-2 block text-xs leading-[1.4] text-text-secondary">
              {m.admin_meili_reset_everything_description()}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-error-text"
              onClick={() => onResetDialogOpenChange(true)}
              disabled={isResetPending}
            >
              {isResetPending
                ? m.admin_meili_resetting()
                : m.admin_meili_reset_everything_title()}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={resetDialogOpen}
        onOpenChange={(open) => {
          onResetDialogOpenChange(open);
          if (!open) onResetConfirmTextChange("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.admin_meili_reset_dialog_title()}</DialogTitle>
            <DialogDescription>
              {m.admin_meili_reset_dialog_description()}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <p className="mb-2 text-sm leading-[1.4]">
              {m.admin_meili_reset_type_to_confirm_prefix()}{" "}
              <strong>{RESET_CONFIRMATION_TOKEN}</strong>{" "}
              {m.admin_meili_reset_type_to_confirm_suffix()}
            </p>
            <Input
              autoFocus
              value={resetConfirmText}
              onChange={(event) => onResetConfirmTextChange(event.target.value)}
              placeholder={RESET_CONFIRMATION_TOKEN}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onResetDialogOpenChange(false);
                onResetConfirmTextChange("");
              }}
            >
              {m.common_cancel()}
            </Button>
            <Button
              variant="outline"
              className="text-error-text"
              disabled={resetConfirmText !== RESET_CONFIRMATION_TOKEN}
              onClick={() => {
                onReset();
                onResetDialogOpenChange(false);
                onResetConfirmTextChange("");
              }}
            >
              {m.admin_meili_delete_all_indexes()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
