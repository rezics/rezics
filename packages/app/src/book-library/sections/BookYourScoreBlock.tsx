import { useCurrentUserId } from "@rezics/contract/api/hooks/useCurrentUserId";
import { getDefaultRealmId } from "@rezics/contract/api/infra/bootstrap";
import {
  useDeleteScoreMutation,
  useUpsertScoreMutation,
} from "@rezics/contract/api/score/score.mutations";
import { scoreQueries } from "@rezics/contract/api/score/score.queries";
import { SCORE_MAX } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
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

interface BookYourScoreBlockProps {
  bookUnitId: string;
  realmId?: string;
}

export const BookYourScoreBlock: React.FC<BookYourScoreBlockProps> = ({
  bookUnitId,
  realmId = getDefaultRealmId() ?? "default",
}) => {
  const { t } = useTranslation(["book", "common"]);
  const userId = useCurrentUserId();
  const isAuthed = Boolean(userId);

  const { data: existing } = useQuery({
    ...scoreQueries.userScoreForRealm(userId ?? "", bookUnitId, realmId),
    enabled: isAuthed && Boolean(bookUnitId) && Boolean(realmId),
  });
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
            {t("book:hero_your_score_rate")}
          </span>
        </>
      )}
    </button>
  );

  const trigger = (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold tracking-[0.12em] uppercase text-white/65">
        {t("book:hero_your_score_label")}
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
            <TooltipContent>{t("book:hero_your_score_sign_in")}</TooltipContent>
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
                ? t("book:hero_your_score_dialog_edit")
                : t("book:hero_your_score_dialog_rate")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 pt-2">
            <RatingInput
              max={SCORE_MAX}
              size="lg"
              value={draft}
              onChange={(v) => setDraft(v)}
              aria-label={t("book:hero_your_score_dialog_rate")}
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
                {t("book:hero_your_score_remove")}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || draft == null || draft < 1}
            >
              {isPending ? t("common:saving") : t("common:submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
