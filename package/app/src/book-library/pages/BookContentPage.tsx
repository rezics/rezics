import { Box, Paper, Stack, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { ChapterList } from "../components/Chapter/ChapterList";
import { ReleaseSelector } from "../components/ReleaseSelector";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { useReleaseSelection } from "../hooks/useReleaseSelection";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

const ContentSidebar: React.FC<{ textLength: number; pageCount?: number }> = ({
  textLength,
  pageCount,
}) => (
  <Paper variant="outlined" sx={{ p: 2 }}>
    <Typography variant="subtitle1" fontWeight={600} mb={1}>
      Reading
    </Typography>
    <Stack spacing={1}>
      <Typography variant="body2">
        Text length: {textLength.toLocaleString()}
      </Typography>
      {pageCount != null && (
        <Typography variant="body2">Pages: {pageCount}</Typography>
      )}
    </Stack>
  </Paper>
);

export const BookContentPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const [selectedLang] = useBookLanguage(bookId, bookInfo);
  const [selectedReleaseUnitId, setSelectedRelease] = useReleaseSelection(
    bookInfo,
    selectedLang,
  );

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
    <Stack spacing={3}>
      <ReleaseSelector
        bookInfo={bookInfo}
        selectedLang={selectedLang}
        selectedReleaseUnitId={selectedReleaseUnitId}
        onSelect={setSelectedRelease}
      />

      <Box className="lg:hidden">
        <ContentSidebar
          textLength={bookInfo.textLength ?? 0}
          pageCount={bookInfo.pageCount ?? undefined}
        />
      </Box>

      <ChapterList id={selectedReleaseUnitId || bookInfo.unitId} />
    </Stack>
  );
};
