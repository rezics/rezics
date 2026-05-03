import { MenuItem, Stack, TextField, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useSetTranslationSourceMutation } from "@rezics/api/unit/translation-source.mutations";
import type { BookDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { getBookTitle } from "@/shared/utils/translation-helpers";

export interface SetSourceReleaseControlProps {
  book: BookDTO;
  language: string;
  currentSourceReleaseUnitId: string | null | undefined;
}

/**
 * Inline control that lets the user wire (or unwire) the current language's
 * `sourceReleaseUnitId`. Available even when no source is set yet — that's how
 * a user gets a sync target onto an existing translation.
 */
export const SetSourceReleaseControl: React.FC<
  SetSourceReleaseControlProps
> = ({ book, language, currentSourceReleaseUnitId }) => {
  const { t } = useTranslation();

  const siblingFilter = book.workUnitId
    ? { workUnitId: book.workUnitId }
    : { workUnitId: book.unitId };
  const { data: siblings } = useQuery({
    ...bookQueries.list({ ...siblingFilter, limit: 50 }),
    enabled: Boolean(book.unitId),
  });

  const mutation = useSetTranslationSourceMutation();

  const candidates = (siblings?.books ?? []).filter(
    (b) => b.unitId !== book.unitId,
  );

  return (
    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
      <Typography variant="caption" color="text.secondary">
        {t("page.book_edit.info.translation.set_source.label")}
      </Typography>
      <TextField
        select
        size="small"
        variant="standard"
        sx={{ minWidth: 240 }}
        value={currentSourceReleaseUnitId ?? ""}
        onChange={(e) =>
          mutation.mutate({
            workId: book.unitId,
            lang: language,
            body: { sourceReleaseUnitId: e.target.value || null },
          })
        }
        disabled={mutation.isPending}
      >
        <MenuItem value="">
          <Typography component="span" color="text.secondary">
            {t("page.book_edit.info.translation.set_source.none")}
          </Typography>
        </MenuItem>
        {candidates.map((b) => (
          <MenuItem key={b.unitId} value={b.unitId}>
            {getBookTitle(b) || b.unitId}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
};
