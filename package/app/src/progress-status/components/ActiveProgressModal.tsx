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
import { useTranslation } from "@rezics/i18n/react";
import { ChapterPicker } from "./ChapterPicker";

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
  const { t } = useTranslation();
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
          <DialogTitle>
            {t("progress_status.active_modal.title", "更新閱讀進度")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "progress_status.active_modal.description",
              "拖動滑桿更新進度百分比，並可選定目前章節。",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="progress-status-pct">
              {t("progress_status.active_modal.progress_label", "進度")} ·{" "}
              {progressPct}%
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
            <Label>
              {t("progress_status.active_modal.chapter_label", "目前章節")}
            </Label>
            <ChapterPicker
              bookUnitId={bookUnitId}
              value={chapterUnitId}
              onChange={setChapterUnitId}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("common.cancel", "取消")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {t("common.save", "儲存")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
