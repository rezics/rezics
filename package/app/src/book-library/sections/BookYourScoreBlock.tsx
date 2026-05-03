import { StarBorder, StarRounded } from "@mui/icons-material";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating,
  Tooltip,
} from "@mui/material";
import { useCurrentUnitId } from "@rezics/api/hooks";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import {
  scoreQueries,
  useDeleteScoreMutation,
  useUpsertScoreMutation,
} from "@rezics/api/score/score";
import { SCORE_MAX } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface BookYourScoreBlockProps {
  bookUnitId: string;
  realmId?: string;
}

export const BookYourScoreBlock: React.FC<BookYourScoreBlockProps> = ({
  bookUnitId,
  realmId = getDefaultRealmId() ?? "default",
}) => {
  const { t } = useTranslation();
  const userUnitId = useCurrentUnitId();
  const isAuthed = Boolean(userUnitId);

  const { data: userScores } = useQuery({
    ...scoreQueries.userScores(userUnitId ?? "", bookUnitId),
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
          <StarRounded
            sx={{ color: "var(--rezics-color-brand-fill)", fontSize: 30 }}
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
          <StarBorder
            sx={{ color: "var(--rezics-color-brand-fill)", fontSize: 30 }}
          />
          <span className="text-base font-medium text-brand">
            {t("book.hero.your_score.rate", "Rate")}
          </span>
        </>
      )}
    </button>
  );

  const trigger = (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold tracking-[0.12em] uppercase text-white/65">
        {t("book.hero.your_score.label", "YOUR SCORE")}
      </span>
      {button}
    </div>
  );

  return (
    <>
      {isAuthed ? (
        trigger
      ) : (
        <Tooltip title={t("book.hero.your_score.sign_in", "登入後可評分")}>
          <span>{trigger}</span>
        </Tooltip>
      )}

      <Dialog
        open={open}
        onClose={() => !isPending && setOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          {currentValue
            ? t("book.hero.your_score.dialog_edit", "修改評分")
            : t("book.hero.your_score.dialog_rate", "為這本書評分")}
        </DialogTitle>
        <DialogContent>
          <div className="flex flex-col items-center gap-3 pt-2">
            <Rating
              max={SCORE_MAX}
              precision={1}
              size="large"
              value={draft}
              onChange={(_, v) => setDraft(v)}
            />
            <span className="text-sm text-text-secondary tabular-nums">
              {draft ? `${draft} / ${SCORE_MAX}` : "—"}
            </span>
          </div>
        </DialogContent>
        <DialogActions>
          {existing && (
            <Button
              color="error"
              onClick={handleRemove}
              disabled={isPending}
              sx={{ mr: "auto" }}
            >
              {t("book.hero.your_score.remove", "移除評分")}
            </Button>
          )}
          <Button onClick={() => setOpen(false)} disabled={isPending}>
            {t("common.cancel", "取消")}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSubmit}
            disabled={isPending || draft == null || draft < 1}
          >
            {isPending
              ? t("common.saving", "Saving…")
              : t("common.submit", "Submit")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
