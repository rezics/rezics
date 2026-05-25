import { useCurrentUserId } from "@rezics/api/hooks";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import {
  scoreQueries,
  useDeleteScoreMutation,
  useUpsertScoreMutation,
} from "@rezics/api/score/score";
import { SCORE_MAX } from "@rezics/contract";
import {
  book_hero_your_score_dialog_edit,
  book_hero_your_score_dialog_rate,
  book_hero_your_score_label,
  book_hero_your_score_rate,
  book_hero_your_score_remove,
  book_hero_your_score_sign_in,
  common_cancel,
  common_saving,
  common_submit,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { RatingInput } from "@rezics/ui";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

const i18nMessages = {
  book_hero_your_score_dialog_edit,
  book_hero_your_score_dialog_rate,
  book_hero_your_score_label,
  book_hero_your_score_rate,
  book_hero_your_score_remove,
  book_hero_your_score_sign_in,
  common_cancel,
  common_saving,
  common_submit,
};

interface BookYourScoreBlockProps {
  bookUnitId: string;
  realmId?: string;
}

export const BookYourScoreBlock: React.FC<BookYourScoreBlockProps> = ({
  bookUnitId,
  realmId = getDefaultRealmId() ?? "default",
}) => {
  const m = useMessage(i18nMessages);
  const userId = useCurrentUserId();
  const isAuthed = Boolean(userId);

  const { data: userScores } = useQuery({
    ...scoreQueries.userScores(userId ?? "", bookUnitId),
    enabled: isAuthed && Boolean(bookUnitId),
  });
  const existing = userScores?.find((s) => s.realm === realmId);
  const currentValue = existing?.value ?? null;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number | null>(currentValue);

  useEffect(() => {
    setDraft(currentValue);
  }, [currentValue]);

  const upsert = useUpsertScoreMutation({ onSuccess: () => setOpen(false) });
  const remove = useDeleteScoreMutation({ onSuccess: () => setOpen(false) });

  const isPending = upsert.isPending || remove.isPending;

  const handleSubmit = () => {
    if (draft == null || draft < 1) return;
    upsert.mutate({ unitId: bookUnitId, realm: realmId, value: draft });
  };

  const handleRemove = () => {
    if (!existing) return;
    remove.mutate({ id: existing.id, unitId: bookUnitId });
  };

  const button = (
    <button
      type="button"
      onClick={() => isAuthed && setOpen(true)}
      disabled={!isAuthed}
      className="flex items-center gap-1.5 min-h-[2.25rem] rounded-md px-2 -mx-2 hover:bg-white/5 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 text-left"
    >
      {currentValue ? (
        <>
          <Star
            className="w-[30px] h-[30px]"
            fill="currentColor"
            style={{ color: "var(--colors-brand-fill)" }}
          />
          <span className="inline-flex items-baseline gap-1 text-white">
            <span className="text-xl font-semibold tabular-nums leading-none">
              {currentValue}
            </span>
            <span className="text-xs text-white/70">/&nbsp;10</span>
          </span>
        </>
      ) : (
        <>
          <Star
            className="w-[30px] h-[30px]"
            style={{ color: "var(--colors-brand-fill)" }}
          />
          <span className="text-base font-medium text-brand-fill">
            {m.book_hero_your_score_rate()}
          </span>
        </>
      )}
    </button>
  );

  const trigger = (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold tracking-[0.12em] uppercase text-white/65">
        {m.book_hero_your_score_label()}
      </span>
      {button}
    </div>
  );

  return (
    <>
      {isAuthed ? (
        trigger
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={(props) => <span {...props}>{trigger}</span>}
            />
            <TooltipContent>{m.book_hero_your_score_sign_in()}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!isPending) setOpen(o);
        }}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {currentValue
                ? m.book_hero_your_score_dialog_edit()
                : m.book_hero_your_score_dialog_rate()}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 pt-2">
            <RatingInput
              max={SCORE_MAX}
              size="lg"
              value={draft}
              onChange={(v) => setDraft(v)}
              aria-label={m.book_hero_your_score_dialog_rate()}
            />
            <span className="text-sm text-text-secondary tabular-nums">
              {draft ? `${draft} / ${SCORE_MAX}` : "—"}
            </span>
          </div>
          <DialogFooter>
            {existing && (
              <Button
                variant="destructive"
                onClick={handleRemove}
                disabled={isPending}
                className="mr-auto"
              >
                {m.book_hero_your_score_remove()}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {m.common_cancel()}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || draft == null || draft < 1}
            >
              {isPending ? m.common_saving() : m.common_submit()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
