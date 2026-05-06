import { bookChapterIndexQuery } from "@rezics/api/book/book";
import { bookQueries } from "@rezics/api/book/book.queries";
import type { ContentRating } from "@rezics/contract";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { ChapterTreeJsonEditor } from "@/book-library/components/Chapter/ChapterTreeJsonEditor";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { bookEditLayoutRoute } from "@/router";
import { withBookIndexOccurrences } from "@/book-library/models/bookIndexPath";
import {
  ChapterTreeEditor,
  type Chapter,
  type ChapterTreeEditorHandle,
} from "../components/ChapterTreeEditor";

export const BookEditChapterListPage: React.FC = () => {
  const { bookId } = bookEditLayoutRoute.useParams();
  const queryClient = useQueryClient();
  const editorRef = useRef<ChapterTreeEditorHandle | null>(null);
  const [tab, setTab] = useState<"editor" | "json">("editor");

  const { data, isLoading, error } = useQuery(bookQueries.chapterIndex(bookId));
  const { data: bookData } = useQuery(bookQueries.detail(bookId));

  const chapterTree: Chapter[] = useMemo(
    () => withBookIndexOccurrences(data?.index ?? []),
    [data],
  );
  const bookRating = (bookData?.rating ?? "GENERAL") as ContentRating;

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

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "editor" | "json")}
        className="mb-2"
      >
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="editor">
          <ChapterTreeEditor
            ref={editorRef}
            chapterTree={chapterTree}
            bookUnitId={bookId}
            bookRating={bookRating}
            onDownloadJSON={downloadJSON}
          />
        </TabsContent>
        <TabsContent value="json">
          <ChapterTreeJsonEditor bookId={bookId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
