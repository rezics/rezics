import { bookQueries } from "@rezics/api/book/book";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { mainMarkdownSource } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { RemarkInlineForm } from "@/remark";
import { useNavigateToBookTagSearch } from "@/search";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { TagInteraction } from "@/tag";
import { BookCopyrightNotice } from "../components/BookCopyrightNotice";
import { BookDescription } from "../components/BookDescription";
import { MetadataPanel } from "../components/BookDetail/MetadataPanel";
import { ExcerptPreview } from "../components/ExcerptPreview";
import { RemarkPreview } from "../components/RemarkPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

/**
 * 书籍基本信息页面。展示书籍的描述、标签、摘录和评论等基本信息。
 * Book Basic Info Page: displays description, tags, excerpts, and remarks for a book.
 *
 * Layout breakpoints:
 *
 * Mobile (<640px):
 * ┌──────────────────────┐
 * │ Book Description     │
 * │ [Full width content] │
 * ├──────────────────────┤
 * │ Metadata Panel       │
 * │ (inline variant)     │
 * ├──────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━  │ (Separator)
 * ├──────────────────────┤
 * │ Tags Section         │
 * │ [Tag list display]   │
 * ├──────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━  │
 * ├──────────────────────┤
 * │ Excerpts → More      │
 * │ [Excerpt preview]    │
 * ├──────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━  │
 * ├──────────────────────┤
 * │ Remarks             │
 * │ [Form + Preview]    │
 * ├──────────────────────┤
 * │ Copyright Notice    │
 * └──────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Book Description (wider)           │
 * │ [Content spans full width]         │
 * ├────────────────────────────────────┤
 * │ Metadata Panel (inline)            │
 * ├────────────────────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
 * ├────────────────────────────────────┤
 * │ Tags Section [with navigation]     │
 * │ [Tag list display (more visible)]  │
 * ├────────────────────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
 * ├────────────────────────────────────┤
 * │ Excerpts → More                    │
 * │ [Excerpt preview (larger)]         │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌─────────────────────────────────────────────┐
 * │ Book Description                            │
 * │ [Content constrained width]                 │
 * ├─────────────────────────────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
 * ├─────────────────────────────────────────────┤
 * │ Tags Section [with search navigation]       │
 * │ [Complete tag list with interactions]       │
 * ├─────────────────────────────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
 * ├─────────────────────────────────────────────┤
 * │ Excerpts → More                             │
 * │ [Full excerpt preview with details]         │
 * ├─────────────────────────────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
 * ├─────────────────────────────────────────────┤
 * │ Remarks [with full interaction form]        │
 * │ [Full preview]                              │
 * └─────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌─────────────────────────────────────────────────────┐
 * │ [Sidebar (hidden)]  │ Main Content (optimal width)  │
 * │ Metadata Panel (lg) │ Book Description              │
 * │ [sticky/fixed]      │ [Comfortable reading width]   │
 * │                     ├───────────────────────────────┤
 * │                     │ ━━━━━━━━━━━━━━━━━━━━━━━━  │
 * │                     ├───────────────────────────────┤
 * │                     │ Tags [full interaction]       │
 * │                     │ [Complete tag cloud]          │
 * │                     ├───────────────────────────────┤
 * │                     │ Excerpts [full preview]       │
 * │                     ├───────────────────────────────┤
 * │                     │ Remarks [full form + preview] │
 * │                     │ [Complete discussion]         │
 * │                     └───────────────────────────────┘
 */
export const BookBasicInfoPage: React.FC = () => {
  const { t } = useTranslation(["book"]);
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
  const [selectedLang] = useBookLanguage(bookId, bookInfo);
  const navigateToBookTagSearch = useNavigateToBookTagSearch();

  const { data: tagsData } = useQuery({
    ...tagQueries.forUnit(bookId),
    enabled: Boolean(bookId),
  });
  const unitTags = tagsData?.tags ?? [];
  const tagUnitIds = unitTags.map((tag) => tag.tagUnitId);
  const { data: tagTranslations } = useQuery(
    tagQueries.batchTranslations(tagUnitIds, selectedLang),
  );

  const sidebar = useMemo(() => {
    if (!bookInfo) return null;
    return (
      <div className="flex flex-col gap-6">
        <MetadataPanel bookInfo={bookInfo} />
      </div>
    );
  }, [bookInfo]);
  useBookDetailSidebar(sidebar);

  if (!bookInfo) return null;

  const description =
    mainMarkdownSource(
      getTranslation(
        bookInfo.translations,
        selectedLang,
        bookInfo.defaultLanguage ?? undefined,
      )?.description,
    ) ?? "";

  return (
    <div className="flex flex-col gap-8">
      <BookDescription description={description} />

      <div className="lg:hidden">
        <MetadataPanel bookInfo={bookInfo} variant="inline" />
      </div>

      {unitTags.length > 0 && (
        <>
          <Separator />
          <div>
            <AccentBarWithText text={t("book:fields_tags")} />
            <div className="mt-2">
              <TagInteraction
                tags={unitTags}
                translations={tagTranslations ?? {}}
                bookUnitId={bookInfo.unitId ?? bookId}
                bookUnit={bookInfo}
                onSearchTags={navigateToBookTagSearch}
              />
            </div>
          </div>
        </>
      )}

      <Separator />

      <div>
        <ArrowForwardIcon size={16} to={`/excerpt/book/${bookInfo.unitId}`}>
          <AccentBarWithText text={t("book:excerpts")} />
        </ArrowForwardIcon>
      </div>
      <ExcerptPreview id={bookInfo.unitId || ""} />

      <Separator />

      <div>
        <div>
          <ArrowForwardIcon
            size={16}
            to={`/review/book/${bookInfo.unitId}?tab=remark`}
          >
            <AccentBarWithText text={t("book:remark")} />
          </ArrowForwardIcon>
        </div>
        <div className="mt-3 mb-4">
          <RemarkInlineForm bookUnitId={bookInfo.unitId || ""} />
        </div>
        <RemarkPreview bookId={bookInfo.unitId || ""} />
      </div>

      <BookCopyrightNotice />
    </div>
  );
};
