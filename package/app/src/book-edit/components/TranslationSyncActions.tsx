import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";
import { getTranslation } from "@/shared/utils/translation-helpers";
import type { TranslationDraft as EditorDraft } from "../hooks/useBookTranslationEditor";
import {
  ExternalLink as LaunchIcon,
  RefreshCw as SyncIcon,
} from "lucide-react";

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
    <div className="flex flex-col gap-2">
      <span className="text-xs text-text-secondary">
        {t("page.book_edit.info.translation.source.label")}: {sourceTitle}
      </span>
      <div className="flex flex-row gap-2 flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <span {...props}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSync}
                    disabled={!sourceTranslation || isFetching}
                  >
                    <SyncIcon className="w-4 h-4 mr-2" />
                    {t("page.book_edit.info.translation.source.sync_button")}
                  </Button>
                </span>
              )}
            />
            <TooltipContent>
              {sourceTranslation
                ? t("page.book_edit.info.translation.source.sync_tooltip")
                : t("page.book_edit.info.translation.source.no_match", {
                    lang: language,
                  })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            navigate({
              to: "/book/$bookId/edit",
              params: { bookId: sourceReleaseUnitId },
              search: { lang: language },
            })
          }
        >
          <LaunchIcon className="w-4 h-4 mr-2" />
          {t("page.book_edit.info.translation.source.open_button")}
        </Button>
      </div>
    </div>
  );
};
