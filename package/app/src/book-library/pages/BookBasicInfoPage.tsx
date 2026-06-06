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
import { useNavigateToBookTagSearch } from "@/search/hooks/useNavigateToBookTagSearch";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { Link } from "@/shared/ui/link";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { TagInteraction } from "@/tag/components/TagInteraction";
import { BookCopyrightNotice } from "../components/BookCopyrightNotice";
import { BookDescription } from "../components/BookDescription";
import { MetadataPanel } from "../components/BookDetail/MetadataPanel";
import { ExcerptPreview } from "../components/ExcerptPreview";
import { RemarkPreview } from "../components/RemarkPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

export const BookBasicInfoPage: React.FC = () => {
  const { t } = useTranslation(["book"]);
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const readContext = useReadLanguageContext();
  const { data } = useQuery({
    ...bookQueries.detail(bookId, { languages: readContext.languages }),
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
