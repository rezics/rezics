import { bookChapterIndexQuery } from "@rezics/api/book/book";
import type { ChapterTreeItem } from "@rezics/contract";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@rezics/ui/shadcn/tabs.tsx";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { bookQueries } from "@rezics/api/book/book.queries";
import { ChapterTreeJsonEditor } from "@/book-library/component/Chapter/ChapterTreeJsonEditor";
import { bookEditLayoutRoute } from "@/router";
import {
  ChapterTreeEditor,
  type ChapterTreeEditorHandle,
} from "../component/ChapterTreeEditor";

export const BookEditChapterListPage: React.FC = () => {
  const { bookId } = bookEditLayoutRoute.useParams();
  const queryClient = useQueryClient();
  const editorRef = useRef<ChapterTreeEditorHandle | null>(null);
  const [containerHeight, setContainerHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(0);

  const { data, isLoading, error } = useQuery(bookQueries.chapterIndex(bookId));

  const chapterTree: ChapterTreeItem[] = useMemo(
    () => data?.index ?? [],
    [data],
  );

  // Use callback ref so measurement happens when the DOM node actually mounts
  const observerRef = useRef<ResizeObserver | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    containerRef.current = el;
    if (!el) return;

    const update = () => {
      setContainerWidth(el.clientWidth);
      const rect = el.getBoundingClientRect();
      const available = window.innerHeight - rect.top - 80;
      setContainerHeight(Math.max(500, available));
    };
    update();

    observerRef.current = new ResizeObserver(() => update());
    observerRef.current.observe(el);
    window.addEventListener("resize", update);
  }, []);

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
      <div className="mt-10 mx-auto max-w-2xl px-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-10 mx-auto max-w-2xl px-4">
        <div className="text-destructive">Error: {String(error)}</div>
      </div>
    );
  }

  return (
    <div className="mt-10 mx-auto max-w-2xl px-4" ref={containerCallbackRef}>
      <h2 className="text-lg font-semibold mb-4">Chapter Management</h2>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="editor">
          <ChapterTreeEditor
            ref={editorRef}
            chapterTree={chapterTree}
            bookUnitId={bookId}
            height={containerHeight}
            width={containerWidth > 0 ? containerWidth - 4 : undefined}
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
