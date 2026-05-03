import { Button, Stack, Tooltip, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { getTranslation } from "@/shared/utils/translation-helpers";
import type { TranslationDraft as EditorDraft } from "../hooks/useBookTranslationEditor";
import { ExternalLink as LaunchIcon, RefreshCw as SyncIcon } from "lucide-react";

export interface TranslationSyncActionsProps {
  /** Source release unit id this language is wired to. Falsy disables actions. */
  sourceReleaseUnitId: string | null | undefined;
  /** Currently selected language. */
  language: string;
  /** Called with a fresh draft to overwrite the local form. */
  onSync: (draft: EditorDraft) => void;
}

/**
 * Shown when the current language's translation has a `sourceReleaseUnitId`.
 * Offers two actions: pull the source release's fields into the form (purely
 * client-side prefill — caller saves explicitly), and navigate to the source
 * release's edit page.
 */
export const TranslationSyncActions: React.FC<TranslationSyncActionsProps> = ({
  sourceReleaseUnitId,
  language,
  onSync,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: sourceBook, isFetching } = useQuery({
    ...bookQueries.detail(sourceReleaseUnitId ?? ""),
    enabled: Boolean(sourceReleaseUnitId),
  });

  if (!sourceReleaseUnitId) return null;

  const sourceTranslation = getTranslation(
    (sourceBook as BookDTO | undefined)?.translations,
    language,
    (sourceBook as BookDTO | undefined)?.defaultLanguage ?? undefined,
    language,
  );

  const handleSync = () => {
    if (!sourceTranslation) return;
    onSync({
      title: sourceTranslation.title ?? "",
      subtitle: sourceTranslation.subtitle ?? "",
      summary: sourceTranslation.summary ?? "",
      description: sourceTranslation.description ?? "",
    });
  };

  const sourceTitle =
    getTranslation(
      (sourceBook as BookDTO | undefined)?.translations,
      language,
      (sourceBook as BookDTO | undefined)?.defaultLanguage ?? undefined,
    )?.title ?? sourceReleaseUnitId;

  return (
    <Stack direction="column" gap={1}>
      <Typography variant="caption" color="text.secondary">
        {t("page.book_edit.info.translation.source.label")}: {sourceTitle}
      </Typography>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Tooltip
          title={
            sourceTranslation
              ? t("page.book_edit.info.translation.source.sync_tooltip")
              : t("page.book_edit.info.translation.source.no_match", {
                  lang: language,
                })
          }
        >
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SyncIcon fontSize="small" />}
              onClick={handleSync}
              disabled={!sourceTranslation || isFetching}
            >
              {t("page.book_edit.info.translation.source.sync_button")}
            </Button>
          </span>
        </Tooltip>
        <Button
          size="small"
          variant="text"
          startIcon={<LaunchIcon fontSize="small" />}
          onClick={() =>
            navigate({
              to: "/book/$bookId/edit",
              params: { bookId: sourceReleaseUnitId },
              search: { lang: language },
            })
          }
        >
          {t("page.book_edit.info.translation.source.open_button")}
        </Button>
      </Stack>
    </Stack>
  );
};

