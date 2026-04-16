import { Box, Divider, Paper, Stack, Typography } from "@mui/material";
import type { BookDTO } from "@rezics/contract";
import { useTranslation } from "react-i18next";
import {
  getBookAuthorName,
  getBookPublisherName,
  getBookTitle,
  getPersonCredits,
} from "@/shared/util/translation-helpers";

type Book = BookDTO;

export function BookDetailSidebar({ bookInfo }: { bookInfo: Book }) {
  const { t } = useTranslation();
  const title = getBookTitle(bookInfo);
  const authorName = getBookAuthorName(bookInfo);
  const publisherName = getBookPublisherName(bookInfo);
  const producerCredits = getPersonCredits(bookInfo?.personCredits, 'producer');
  const producerName = producerCredits[0]?.name ?? '';

  return (
    <Paper className="p-3 mt-4">
      <Divider className="my-4" />

      <Box>
        <Typography variant="h6" className="font-bold mb-4">
          {t("book.info_panel.title")}
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body2">
            {t("book.fields.title")}：{title}
          </Typography>
          <Typography variant="body2">
            {t("book.fields.author")}：{authorName}
          </Typography>
          <Typography variant="body2">
            {t("book.fields.press")}：{publisherName}
          </Typography>
          {producerName && (
            <Typography variant="body2">
              {t("book.fields.producer")}：{producerName}
            </Typography>
          )}
          <Typography variant="body2">
            {t("book.fields.text_length")}：{bookInfo?.textLength ?? 0}
          </Typography>
          <Typography variant="body2">
            {t("book.fields.isbn")}：{bookInfo?.isbn13 ?? ' '}
          </Typography>
          {bookInfo?.pageCount && (
            <Typography variant="body2">
              {t("book.fields.page_count" as any)}：{bookInfo.pageCount}
            </Typography>
          )}
          {bookInfo?.formatKey && (
            <Typography variant="body2">
              {t("book.fields.format" as any)}：{bookInfo.formatKey}
            </Typography>
          )}
        </Stack>
      </Box>
    </Paper>
  );
}
