import { Box, Divider, Stack } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useTranslation } from "react-i18next";
import { getTranslation } from "@/shared/util/translation-helpers";
import { WorkReleaseNav } from "@/i18n/component/WorkReleaseNav";
import { RemarkInlineForm } from "@/remark/component/RemarkInlineForm";
import { BookDescription } from "../component/BookDescription";
import { MetadataPanel } from "../component/BookDetail/MetadataPanel";
import { QuoteExcerptPreview } from "../component/QuoteExcerptPreview";
import { RemarkPreview } from "../component/RemarkPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { BookDetailShell } from "../section/BookDetailSection";
import { bookDetailAtomFamily } from "../state/bookDetailAtoms";

export const BookBasicInfoPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  const { t } = useTranslation();
  const [selectedLang] = useBookLanguage(bookId, bookInfo);

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
