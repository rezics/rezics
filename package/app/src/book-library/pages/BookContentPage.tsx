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
  <div className="bg-surface-elevated p-4 border border-border-whisper rounded-md">
    <h3 className="text-base font-semibold mb-2">Reading</h3>
    <div className="flex flex-col gap-2">
      <p className="text-sm">Text length: {textLength.toLocaleString()}</p>
      {pageCount != null && <p className="text-sm">Pages: {pageCount}</p>}
    </div>
  </div>
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
    <div className="flex min-h-0 flex-col gap-6">
      <ReleaseSelector
        bookInfo={bookInfo}
        selectedLang={selectedLang}
        selectedReleaseUnitId={selectedReleaseUnitId}
        onSelect={setSelectedRelease}
      />

      <div className="lg:hidden">
        <ContentSidebar
          textLength={bookInfo.textLength ?? 0}
          pageCount={bookInfo.pageCount ?? undefined}
        />
      </div>

      <ChapterList id={selectedReleaseUnitId || bookInfo.unitId} />
    </div>
  );
};
