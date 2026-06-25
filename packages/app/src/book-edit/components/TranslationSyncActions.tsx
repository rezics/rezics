import { bookQueries } from "@rezics/contract/api/book/book.queries";
import { type BookDTO, mainMarkdownSource } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ExternalLink as LaunchIcon,
  RefreshCw as SyncIcon,
} from "lucide-react";
import type React from "react";
import { getTranslation } from "@/shared/utils/translation-helpers";
import type { TranslationDraft as EditorDraft } from "../hooks/useBookTranslationEditor";

export interface TranslationSyncActionsProps {
  /** Source unit id this language is wired to. Falsy disables actions. 此语言关联的源 unit id。为假值时禁用操作。 */
  sourceUnitId: string | null | undefined;
  /** Currently selected language. 当前选中的语言。 */
  language: string;
  /** Called with a fresh draft to overwrite the local form. 以新的草稿调用，覆盖本地表单。 */
  onSync: (draft: EditorDraft) => void;
}

/**
 * Shown when the current language's translation has a `sourceUnitId`.
 * Offers two actions: pull the source entry's fields into the form (purely
 * client-side prefill — caller saves explicitly), and navigate to the source
 * entry's edit page.
 * 当前语言的翻译带有 `sourceUnitId` 时显示。
 * 提供两个操作：将源条目的字段拉入表单（纯客户端预填——由调用方显式保存），
 * 以及导航到源条目的编辑页。
 */
export const TranslationSyncActions: React.FC<TranslationSyncActionsProps> = ({
  sourceUnitId,
  language,
  onSync,
}) => {
  const { t } = useTranslation(["page"]);
  const navigate = useNavigate();

  const { data: sourceBook, isFetching } = useQuery({
    ...bookQueries.detail(sourceUnitId ?? ""),
    enabled: Boolean(sourceUnitId),
  });

  if (!sourceUnitId) return null;

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
      description: mainMarkdownSource(sourceTranslation.description) ?? "",
    });
  };

  const sourceTitle =
    getTranslation(
      (sourceBook as BookDTO | undefined)?.translations,
      language,
      (sourceBook as BookDTO | undefined)?.defaultLanguage ?? undefined,
    )?.title ?? sourceUnitId;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-text-secondary">
        {t("page:book_edit_info_translation_source_label")}: {sourceTitle}
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
                    {t("page:book_edit_info_translation_source_sync_button")}
                  </Button>
                </span>
              )}
            />
            <TooltipContent>
              {sourceTranslation
                ? t("page:book_edit_info_translation_source_sync_tooltip")
                : t("page:book_edit_info_translation_source_no_match", {
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
              params: { bookId: sourceUnitId },
              search: { lang: language },
            })
          }
        >
          <LaunchIcon className="w-4 h-4 mr-2" />
          {t("page:book_edit_info_translation_source_open_button")}
        </Button>
      </div>
    </div>
  );
};
