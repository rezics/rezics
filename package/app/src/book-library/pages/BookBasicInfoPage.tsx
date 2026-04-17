import { Box, Divider, Stack } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useTranslation } from "react-i18next";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { WorkReleaseNav } from "@/i18n/components/WorkReleaseNav";
import { RemarkInlineForm } from "@/remark/components/RemarkInlineForm";
import { TagInteraction } from "@/tag/components/TagInteraction";
import { BookDescription } from "../components/BookDescription";
import { MetadataPanel } from "../components/BookDetail/MetadataPanel";
import { QuoteExcerptPreview } from "../components/QuoteExcerptPreview";
import { RemarkPreview } from "../components/RemarkPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { BookDetailShell } from "../sections/BookDetailSection";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";

export const BookBasicInfoPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  const { t } = useTranslation();
  const [selectedLang] = useBookLanguage(bookId, bookInfo);

  const { data: tagsData } = useQuery({
    ...tagQueries.forUnit(bookId),
    enabled: Boolean(bookId),
  });
  const unitTags = tagsData?.tags ?? [];
  const tagUnitIds = unitTags.map((tag) => tag.tagUnitId);
  const { data: tagTranslations } = useQuery(
    tagQueries.batchTranslations(tagUnitIds, selectedLang),
  );

  if (!bookInfo) return null;

  const description =
    getTranslation(bookInfo.translations, selectedLang, bookInfo.defaultLanguage ?? undefined)
      ?.description ?? "";

  const sidebar = (
    <Stack spacing={3}>
      <MetadataPanel bookInfo={bookInfo} />
      {bookInfo.workUnitId && (
        <WorkReleaseNav
          workUnitId={bookInfo.workUnitId}
          currentBookId={bookInfo.unitId}
        />
      )}
    </Stack>
  );

  return (
    <BookDetailShell bookInfo={bookInfo} sidebar={sidebar}>
      <Stack spacing={4}>
        <BookDescription
          description={description}
          bookId={bookInfo.unitId || ""}
        />

        <Box className="lg:hidden">
          <MetadataPanel bookInfo={bookInfo} variant="inline" />
        </Box>

        {unitTags.length > 0 && (
          <>
            <Divider />
            <div>
              <AccentBarWithText text={t("book.fields.tags", "Tags")} />
              <Box mt={1}>
                <TagInteraction
                  tags={unitTags}
                  translations={tagTranslations ?? {}}
                  bookUnitId={bookInfo.unitId ?? bookId}
                />
              </Box>
            </div>
          </>
        )}

        <Divider />

        <div>
          <ArrowForwardIcon size={16} to={`/quote/book/${bookInfo.unitId}`}>
            <AccentBarWithText text={t("book.quote_excerpts")} />
          </ArrowForwardIcon>
        </div>
        <QuoteExcerptPreview id={bookInfo.unitId || ""} />

        <Divider />

        <div>
          <AccentBarWithText text={t("book.fields.score" as any)} />
          <Box mt={1}>
            <RemarkInlineForm bookUnitId={bookInfo.unitId || ""} />
          </Box>
        </div>

        <Divider />

        <Box>
          <div>
            <ArrowForwardIcon
              size={16}
              to={`/review/book/${bookInfo.unitId}?tab=remark`}
            >
              <AccentBarWithText text={t("book.remark")} />
            </ArrowForwardIcon>
          </div>
          <RemarkPreview bookId={bookInfo.unitId || ""} />
        </Box>

        {bookInfo.workUnitId && (
          <Box className="lg:hidden">
            <WorkReleaseNav
              workUnitId={bookInfo.workUnitId}
              currentBookId={bookInfo.unitId}
            />
          </Box>
        )}
      </Stack>
    </BookDetailShell>
  );
};
