import { Stack } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { ChapterList } from "../component/Chapter/ChapterList";
import { BookDetailShell } from "../section/BookDetailSection";
import { bookDetailAtomFamily } from "../state/bookDetailAtoms";

export const BookContentPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  if (!bookInfo) return null;

  return (
    <BookDetailShell bookInfo={bookInfo}>
      <Stack spacing={4}>
        <ChapterList id={bookInfo?.unitId || "0"} />
      </Stack>
    </BookDetailShell>
  );
};
