import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { LANGUAGE_META, LANGUAGES } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBookTitle } from "@/shared/utils/translation-helpers";

export interface AddTranslationDialogProps {
  open: boolean;
  book: BookDTO | null | undefined;
  existingLanguages: string[];
  onClose: () => void;
  onSubmit: (params: {
    language: string;
    sourceReleaseUnitId: string | null;
  }) => void;
}

const ALL_LANGS = Object.values(LANGUAGES);

export const AddTranslationDialog: React.FC<AddTranslationDialogProps> = ({
  open,
  book,
  existingLanguages,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const available = ALL_LANGS.filter((l) => !existingLanguages.includes(l));
  const [language, setLanguage] = useState<string>(available[0] ?? "");
  const [sourceReleaseUnitId, setSourceReleaseUnitId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setLanguage(available[0] ?? "");
      setSourceReleaseUnitId("");
    }
    // We intentionally only reset on open transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sibling releases under the same work — also let the user pick the work
  // itself (for releases) or any release of this work (for works).
  const siblingFilter = book?.workUnitId
    ? { workUnitId: book.workUnitId }
    : { workUnitId: book?.unitId };
  const { data: siblings } = useQuery({
    ...bookQueries.list({ ...siblingFilter, limit: 50 }),
    enabled: open && Boolean(book?.unitId),
  });

  const candidates = (siblings?.books ?? []).filter(
    (b) => b.unitId !== book?.unitId,
  );

  const handleSubmit = () => {
    if (!language) return;
    onSubmit({
      language,
      sourceReleaseUnitId: sourceReleaseUnitId || null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {t("page.book_edit.info.translation.add_dialog.title")}
      </DialogTitle>
      <DialogContent>
        <Stack gap={3} sx={{ mt: 1 }}>
          <TextField
            select
            size="small"
            variant="standard"
            label={t("page.book_edit.info.translation.add_dialog.language")}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={available.length === 0}
            fullWidth
          >
            {available.map((l) => (
              <MenuItem key={l} value={l}>
                {(LANGUAGE_META as Record<string, { nativeName?: string }>)[l]
                  ?.nativeName ?? l}{" "}
                ({l})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            variant="standard"
            label={t(
              "page.book_edit.info.translation.add_dialog.source_release",
            )}
            value={sourceReleaseUnitId}
            onChange={(e) => setSourceReleaseUnitId(e.target.value)}
            helperText={t(
              "page.book_edit.info.translation.add_dialog.source_release_help",
            )}
            fullWidth
          >
            <MenuItem value="">
              <Typography component="span" color="text.secondary">
                {t("page.book_edit.info.translation.add_dialog.no_source")}
              </Typography>
            </MenuItem>
            {candidates.map((b) => (
              <MenuItem key={b.unitId} value={b.unitId}>
                {getBookTitle(b) || b.unitId}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!language}
        >
          {t("page.book_edit.info.translation.add_dialog.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
