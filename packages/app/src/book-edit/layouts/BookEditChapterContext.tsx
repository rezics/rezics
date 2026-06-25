import { chapterDetailQuery } from "@rezics/contract/api/chapter/chapter.queries";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, ListTree } from "lucide-react";
import { Link } from "@/shared/ui/link";

interface BookEditChapterContextProps {
  bookId: string;
  contentUnitId: string;
}

export function BookEditChapterContext({
  bookId,
  contentUnitId,
}: BookEditChapterContextProps) {
  const { t } = useTranslation(["settings"]);
  const { data, isError, isPending } = useQuery(
    chapterDetailQuery(contentUnitId),
  );
  const title =
    data && "title" in data && typeof data.title === "string" ? data.title : "";

  return (
    <aside
      aria-label={t("settings:edit_console_chapter_context_label")}
      className="grid gap-3 py-2"
    >
      <div className="grid gap-2 rounded-md bg-surface-subtle p-3">
        <div className="flex items-center gap-2 text-xs font-medium leading-dense text-text-secondary">
          <BookOpenText className="h-4 w-4" aria-hidden="true" />
          {t("settings:edit_console_chapter_context_label")}
        </div>
        <p className="line-clamp-3 text-sm font-medium leading-ui text-text-primary">
          {isPending
            ? t("settings:edit_console_chapter_context_loading")
            : isError
              ? t("settings:edit_console_chapter_context_error")
              : title || t("settings:edit_console_chapter_context_untitled")}
        </p>
      </div>

      <Link
        to="/book/$bookId/edit/chapter"
        params={{ bookId }}
        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm leading-ui text-text-secondary no-underline hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <ListTree className="h-4 w-4" aria-hidden="true" />
        {t("settings:edit_console_chapter_context_back_to_chapters")}
      </Link>
    </aside>
  );
}
