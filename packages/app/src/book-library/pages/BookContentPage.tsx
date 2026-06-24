import { bookQueries } from "@rezics/contract/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { ChapterList } from "../components/Chapter/ChapterList";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

const ContentSidebar: React.FC<{ textLength: number; pageCount?: number }> = ({
  textLength,
  pageCount,
}) => {
  const { t } = useTranslation(["book"]);
  return (
    <div className="bg-surface-elevated p-4 border border-border-whisper rounded-md">
      <h3 className="text-base font-semibold mb-2">
        {t("book:content_reading")}
      </h3>
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          {t("book:content_text_length", { count: textLength })}
        </p>
        {pageCount != null && (
          <p className="text-sm">
            {t("book:content_pages", { count: pageCount })}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * 书籍内容页面。展示书籍的章节列表和阅读统计信息。
 * Book Content Page: displays chapter list and reading statistics (text length, page count).
 *
 * Layout breakpoints:
 *
 * Mobile (<640px):
 * ┌──────────────────────┐
 * │ Content Stats        │
 * │ [Reading info card]  │
 * │ Text: 123,456 chars  │
 * │ Pages: 450           │
 * ├──────────────────────┤
 * │ Chapter List         │
 * │ [Chapter 1]          │
 * │ [Chapter 2]          │
 * │ [Chapter 3]          │
 * │ [... more]           │
 * │ (scrollable)         │
 * └──────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Content Stats (inline, at top)     │
 * │ [Reading info card - wider]        │
 * │ Text: 123,456 chars | Pages: 450   │
 * ├────────────────────────────────────┤
 * │ Chapter List (full width)          │
 * │ [Chapter 1      ] | [Chapter 4]    │
 * │ [Chapter 2      ] | [Chapter 5]    │
 * │ [Chapter 3      ] | [... more]     │
 * │ (two-column or list view)          │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌─────────────────────────────────────────────┐
 * │ [Sidebar (hidden)]  │ Main Content area     │
 * │                     │ Content Stats         │
 * │                     │ [Card with info]      │
 * │                     ├─────────────────────┤
 * │                     │ Chapter List         │
 * │                     │ [Complete list]      │
 * │                     │ [Chapter 1]          │
 * │                     │ [Chapter 2]          │
 * │                     │ [Chapter 3]          │
 * │                     │ [... scrollable]     │
 * └─────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌──────────────────────────────────────────────────────┐
 * │ [Sidebar]           │ Main Content (optimal width)   │
 * │ Stats Card (sticky) │ Chapter List                   │
 * │ [Reading info]      │ [Spacious layout]              │
 * │                     │ [Chapter 1 - large]            │
 * │                     │ [Chapter 2 - large]            │
 * │                     │ [Chapter 3 - large]            │
 * │                     │ [... with descriptions]        │
 * └──────────────────────────────────────────────────────┘
 */
export const BookContentPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const readContext = useReadLanguageContext();
  const { data } = useQuery({
    ...bookQueries.detail(bookId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: Boolean(bookId) && readContext.ready,
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  const sidebar = useMemo(() => {
    if (!bookInfo) return null;
    return (
      <ContentSidebar
        textLength={bookInfo.textLength ?? 0}
        pageCount={bookInfo.pageCount ?? undefined}
      />
    );
  }, [bookInfo]);
  useBookDetailSidebar(sidebar);

  if (!bookInfo) return null;

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <div className="lg:hidden">
        <ContentSidebar
          textLength={bookInfo.textLength ?? 0}
          pageCount={bookInfo.pageCount ?? undefined}
        />
      </div>

      <ChapterList id={bookInfo.unitId} />
    </div>
  );
};
