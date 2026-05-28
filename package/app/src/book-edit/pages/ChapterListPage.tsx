import { bookContentStructureQuery } from "@rezics/api/book/book";
import { bookQueries } from "@rezics/api/book/book.queries";
import type { ContentRating } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { BookTocJsonEditor } from "@/book-library/components/Chapter/BookTocJsonEditor";
import { withBookContentStructureOccurrences } from "@/book-library/models/bookContentStructurePath";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { Route as bookEditLayoutRoute } from "@/routes/_editor/book/$bookId/edit/route";
import {
  BookTocEditor,
  type BookTocEditorHandle,
  type Chapter,
} from "../components/BookTocEditor";

export const BookEditChapterListPage: React.FC = () => {
  const { t } = useTranslation(["book", "common"]);
  const { bookId } = bookEditLayoutRoute.useParams();
  const queryClient = useQueryClient();
  const editorRef = useRef<BookTocEditorHandle | null>(null);
  const [tab, setTab] = useState<"editor" | "json">("editor");

  const { data, isLoading, error } = useQuery(
    bookQueries.contentStructure(bookId),
  );
  const { data: bookData } = useQuery(bookQueries.detail(bookId));

  const bookTocTree: Chapter[] = useMemo(
    () => withBookContentStructureOccurrences(data?.nodes ?? []),
    [data],
  );
  const bookRating = (bookData?.rating ?? "GENERAL") as ContentRating;

  async function downloadJSON() {
    const contentStructure = await queryClient.ensureQueryData(
      bookContentStructureQuery(bookId),
    );
    const jsonString = JSON.stringify(contentStructure, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split("T")[0];
    const a = document.createElement("a");
    a.href = url;
    a.download = `content-structure-${bookId}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="mt-4 mx-auto max-w-2xl px-4">
        <div className="text-muted-foreground">{t("common:loading")}</div>
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
    <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-2xl flex-col px-4 pb-4">
      <h2 className="text-lg font-semibold mb-2">
        {t("book:edit_toc_management_title")}
      </h2>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "editor" | "json")}
        className="min-h-0 flex-1"
      >
        <TabsList className="flex-none">
          <TabsTrigger value="editor">{t("common:edit")}</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="editor" className="min-h-0">
          <BookTocEditor
            ref={editorRef}
            bookTocTree={bookTocTree}
            bookUnitId={bookId}
            bookRating={bookRating}
            onDownloadJSON={downloadJSON}
          />
        </TabsContent>
        <TabsContent value="json" className="min-h-0">
          <BookTocJsonEditor bookId={bookId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
