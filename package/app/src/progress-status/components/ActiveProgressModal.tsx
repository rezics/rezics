import {
  common_cancel,
  common_save,
  progress_status_active_modal_chapter_label,
  progress_status_active_modal_description,
  progress_status_active_modal_progress_label,
  progress_status_active_modal_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "@rezics/ui/shadcn";
import { useEffect, useState } from "react";
import { ChapterPicker } from "./ChapterPicker";

const i18nMessages = {
  common_cancel,
  common_save,
  progress_status_active_modal_chapter_label,
  progress_status_active_modal_description,
  progress_status_active_modal_progress_label,
  progress_status_active_modal_title,
};

type ActiveProgressModalProps = {
  open: boolean;
  bookUnitId: string;
  initialProgress?: number;
  initialLastReadNodeId?: string | null;
  onCancel: () => void;
  onSave: (payload: {
    progress: number;
    lastReadNodeId: string | null;
  }) => void;
  isPending?: boolean;
};

export function ActiveProgressModal({
  open,
  bookUnitId,
  initialProgress = 0,
  initialLastReadNodeId = null,
  onCancel,
  onSave,
  isPending,
}: ActiveProgressModalProps) {
  const m = useMessage(i18nMessages);
  const [progressPct, setProgressPct] = useState<number>(
    Math.round((initialProgress ?? 0) * 100),
  );
  const [nodeId, setNodeId] = useState<string | undefined>(
    initialLastReadNodeId ?? undefined,
  );

  useEffect(() => {
    if (open) {
      setProgressPct(Math.round((initialProgress ?? 0) * 100));
      setNodeId(initialLastReadNodeId ?? undefined);
    }
  }, [open, initialProgress, initialLastReadNodeId]);

  const handleSave = () => {
    onSave({
      progress: Math.max(0, Math.min(100, progressPct)) / 100,
      lastReadNodeId: nodeId ?? null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.progress_status_active_modal_title()}</DialogTitle>
          <DialogDescription>
            {m.progress_status_active_modal_description()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="progress-status-pct">
              {m.progress_status_active_modal_progress_label()} · {progressPct}%
            </Label>
            <input
              id="progress-status-pct"
              type="range"
              min={0}
              max={100}
              step={1}
              value={progressPct}
              onChange={(e) => setProgressPct(Number(e.target.value))}
              className="w-full accent-brand-fill"
            />
          </div>

          <div className="grid gap-2">
            <Label>{m.progress_status_active_modal_chapter_label()}</Label>
            <ChapterPicker
              bookUnitId={bookUnitId}
              value={nodeId}
              onChange={setNodeId}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {m.common_cancel()}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
