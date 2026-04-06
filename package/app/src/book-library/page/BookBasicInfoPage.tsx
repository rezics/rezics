import { Box, Divider, Stack } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useTranslation } from "react-i18next";
import { TagWrapper } from "@/tag/component/TagWrapper.tsx";
import { AuthorInfo } from "../component/AuthorInfo";
import { BookDescription } from "../component/BookDescription";
import { QuoteExcerptPreview } from "../component/QuoteExcerptPreview";
import { RemarkPreview } from "../component/RemarkPreview";
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

  if (!bookInfo) return null;
  return (
    <BookDetailShell bookInfo={bookInfo}>
      <Stack spacing={4}>
        <BookDescription
          description={bookInfo?.description || ""}
          bookId={bookInfo?.unitId || ""}
        />
        <Divider />

        <div>
          <ArrowForwardIcon size={16} to={`/tag/book/${bookInfo?.unitId}/tag`}>
            <AccentBarWithText text={t("book.tags")} />
          </ArrowForwardIcon>
        </div>
        <TagWrapper
          filters={{ objectId: bookInfo?.unitId || "" }}
          mode="grouped"
        />
        <Divider />

        <AuthorInfo
          author={
            bookInfo?.author?.[0] || {
              unitId: "",
              name: "",
              bio: "",
              description: "",
            }
          }
        />
        <Divider />

        <div>
          <ArrowForwardIcon size={16} to={`/quote/book/${bookInfo?.unitId}`}>
            <AccentBarWithText text={t("book.quote_excerpts")} />
          </ArrowForwardIcon>
        </div>
        <QuoteExcerptPreview id={bookInfo?.unitId || ""} />
        <Divider />

        <Box>
          <div>
            <ArrowForwardIcon
              size={16}
              to={`/review/book/${bookInfo?.unitId}?tab=remark`}
            >
              <AccentBarWithText text={t("book.remark")} />
            </ArrowForwardIcon>
          </div>
          <RemarkPreview bookId={bookInfo?.unitId || ""} />
        </Box>
      </Stack>
    </BookDetailShell>
  );
};
