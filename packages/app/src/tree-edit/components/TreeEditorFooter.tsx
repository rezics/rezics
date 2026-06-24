import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { RotateCcw, Save } from "lucide-react";
import type React from "react";

interface TreeEditorFooterProps {
  pendingCount: number;
  saving?: boolean;
  summary?: React.ReactNode;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  cancelLabel?: string;
}

export function TreeEditorFooter({
  pendingCount,
  saving,
  summary,
  onCancel,
  onSave,
  saveLabel,
  cancelLabel,
}: TreeEditorFooterProps) {
  const { t } = useTranslation("common");
  const dirty = pendingCount > 0;
  const effectiveSaveLabel = saveLabel ?? t("save");
  const effectiveCancelLabel = cancelLabel ?? t("cancel");
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border-whisper py-3 text-sm leading-ui text-text-secondary">
      <div className="min-w-0">
        {dirty ? (
          <span className="text-text-primary">
            {t("pending_ops", { count: pendingCount })}
          </span>
        ) : (
          summary
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={!dirty || saving}
        >
          <RotateCcw className="mr-2 size-4" aria-hidden />
          {effectiveCancelLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          <Save className="mr-2 size-4" aria-hidden />
          {saving ? t("saving") : effectiveSaveLabel}
        </Button>
      </div>
    </div>
  );
}
