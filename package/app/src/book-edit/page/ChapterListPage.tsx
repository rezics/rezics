import { Tab, Tabs } from "@mui/material";
import { bookChapterIndexQuery } from "@rezics/api/book/book";
import { bookQueries } from "@rezics/api/book/book.queries";
import type { ChapterTreeItem } from "@rezics/contract";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { ChapterTreeJsonEditor } from "@/book-library/component/Chapter/ChapterTreeJsonEditor";
import { QueryErrorDisplay } from "@/core/component/QueryErrorDisplay";
import { bookEditLayoutRoute } from "@/router";
import {
  ChapterTreeEditor,
  type ChapterTreeEditorHandle,
} from "../component/ChapterTreeEditor";

export const BookEditChapterListPage: React.FC = () => {
  const { bookId } = bookEditLayoutRoute.useParams();
  const queryClient = useQueryClient();
  const editorRef = useRef<ChapterTreeEditorHandle | null>(null);
  const [tab, setTab] = useState(0);

  const { data, isLoading, error } = useQuery(bookQueries.chapterIndex(bookId));

  const chapterTree: ChapterTreeItem[] = useMemo(
    () => data?.index ?? [],
    [data],
  );

  async function downloadJSON() {
    const chapterIndex = await queryClient.ensureQueryData(
      bookChapterIndexQuery(bookId),
    );
    const jsonString = JSON.stringify(chapterIndex, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split("T")[0];
    const a = document.createElement("a");
    a.href = url;
    a.download = `chapterIndex-${bookId}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="mt-4 mx-auto max-w-2xl px-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 mx-auto max-w-2xl px-4">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="mt-4 mx-auto max-w-2xl px-4 flex flex-col h-[calc(100vh-5rem)]">
      <h2 className="text-lg font-semibold mb-2">Chapter Management</h2>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab label="Editor" />
        <Tab label="JSON" />
      </Tabs>

      {tab === 0 && (
        <ChapterTreeEditor
          ref={editorRef}
          chapterTree={chapterTree}
          bookUnitId={bookId}
          onDownloadJSON={downloadJSON}
        />
      )}

      {tab === 1 && <ChapterTreeJsonEditor bookId={bookId} />}
    </div>
  );
};
