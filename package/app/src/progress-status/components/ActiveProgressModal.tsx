import type { UnitLastPosition } from "@rezics/contract";
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
import * as m from "@rezics/i18n/messages";

type ActiveProgressModalProps = {
  open: boolean;
  bookUnitId: string;
  initialProgress?: number;
  initialLastPosition?: UnitLastPosition | null;
  onCancel: () => void;
  onSave: (payload: {
    progress: number;
    lastPosition: UnitLastPosition | null;
  }) => void;
  isPending?: boolean;
};

function lastPositionChapterId(
  lp: UnitLastPosition | null | undefined,
): string | undefined {
  if (lp?.kind === "chapter") return lp.chapterUnitId;
  return undefined;
}

export function ActiveProgressModal({
  open,
  bookUnitId,
  initialProgress = 0,
  initialLastPosition = null,
  onCancel,
  onSave,
  isPending,
}: ActiveProgressModalProps) {
  const [progressPct, setProgressPct] = useState<number>(
    Math.round((initialProgress ?? 0) * 100),
  );
  const [chapterUnitId, setChapterUnitId] = useState<string | undefined>(
    lastPositionChapterId(initialLastPosition),
  );

  useEffect(() => {
    if (open) {
      setProgressPct(Math.round((initialProgress ?? 0) * 100));
      setChapterUnitId(lastPositionChapterId(initialLastPosition));
    }
  }, [open, initialProgress, initialLastPosition]);

  const handleSave = () => {
    const lastPosition: UnitLastPosition | null = chapterUnitId
      ? { kind: "chapter", chapterUnitId }
      : null;
    onSave({
      progress: Math.max(0, Math.min(100, progressPct)) / 100,
      lastPosition,
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
              value={chapterUnitId}
              onChange={setChapterUnitId}
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
