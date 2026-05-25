import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { useEffect, useRef, useState } from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  common_cancel,
  common_confirm,
  progress_status_completed_modal_description,
  progress_status_completed_modal_title,
} from "@rezics/i18n/messages";
const m = {
  common_cancel,
  common_confirm,
  progress_status_completed_modal_description,
  progress_status_completed_modal_title,
};

const i18nMessages = {
  common_cancel,
  common_confirm,
  progress_status_completed_modal_description,
  progress_status_completed_modal_title,
};

type CompletedConfirmModalProps = {
  open: boolean;
  currentCount: number;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  isPending?: boolean;
};

const COUNT_DURATION_MS = 220;
const BADGE_FADE_MS = 160;
const MODAL_CLOSE_MS = 150;
const BADGE_DELAY_MS = 120;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CompletedConfirmModal({
  open,
  currentCount,
  onCancel,
  onConfirm,
  isPending,
}: CompletedConfirmModalProps) {
  const m = useMessage(i18nMessages);
  const [displayCount, setDisplayCount] = useState(currentCount);
  const [badgeFading, setBadgeFading] = useState(false);
  const [animating, setAnimating] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (open) {
      setDisplayCount(currentCount);
      setBadgeFading(false);
      setAnimating(false);
    }
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [open, currentCount]);

  const handleConfirm = () => {
    if (animating) return;
    setAnimating(true);
    const reduced = prefersReducedMotion();

    if (reduced) {
      setDisplayCount(currentCount + 1);
      setBadgeFading(true);
      void onConfirm();
      const closeT = setTimeout(onCancel, MODAL_CLOSE_MS);
      timeoutsRef.current.push(closeT);
      return;
    }

    void onConfirm();
    const countT = setTimeout(() => {
      setDisplayCount((c) => c + 1);
    }, BADGE_DELAY_MS);
    const fadeT = setTimeout(
      () => setBadgeFading(true),
      BADGE_DELAY_MS + COUNT_DURATION_MS - BADGE_FADE_MS,
    );
    const closeT = setTimeout(
      onCancel,
      BADGE_DELAY_MS + COUNT_DURATION_MS + MODAL_CLOSE_MS,
    );
    timeoutsRef.current.push(countT, fadeT, closeT);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.progress_status_completed_modal_title()}</DialogTitle>
          <DialogDescription>
            {m.progress_status_completed_modal_description()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-3 py-4">
          <span
            className="text-4xl font-semibold text-text-primary transition-all"
            style={{ transitionDuration: `${COUNT_DURATION_MS}ms` }}
          >
            {displayCount}
          </span>
          <span
            className="rounded-full bg-brand-fill text-text-on-brand px-2 py-0.5 text-xs font-semibold transition-opacity"
            style={{
              transitionDuration: `${BADGE_FADE_MS}ms`,
              opacity: badgeFading ? 0 : 1,
            }}
          >
            +1
          </span>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={animating}
          >
            {m.common_cancel()}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || animating}
          >
            {m.common_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
