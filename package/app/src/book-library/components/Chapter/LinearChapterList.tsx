import { bookQueries } from "@rezics/api/book/book.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Button, Input, Label, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { withBookContentStructureOccurrences } from "../../models/bookContentStructurePath";
import type { ChapterArboristRefHandle } from "./ChapterArborist";
import { ChapterArborist } from "./ChapterArborist";

/** Props for LinearChapterList component. */
interface LinearChapterListProps {
  /** Width of the chapter list. */
  width?: number;
  /** Height of the chapter list. */
  height?: number;
  /** Book unit ID. */
  bookId: string;
  /** Currently selected chapter ID. */
  chapterId?: string;
}

/**
 * Linear Chapter List - Displays chapter tree using arborist (reader-only).
 */
export const LinearChapterList: React.FC<LinearChapterListProps> = ({
  bookId,
  chapterId,
  width = 300,
  height = 300,
}) => {
  const { t } = useTranslation(["book", "common"]);
const { data, isLoading, error } = useQuery(
    bookQueries.contentStructure(bookId),
  );

  const selectedId = chapterId || "";
  const baseLink = bookId;

  const bookTocTree = useMemo(
    () => withBookContentStructureOccurrences(data?.nodes ?? []),
    [data],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const arboristRef = useRef<ChapterArboristRefHandle | null>(null);

  if (!bookId) return null;
  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <div className="w-full">
      <div className="mx-auto">
        <div className="space-y-4 mb-4 w-full pl-2 pr-2">
          <div className="flex flex-row gap-2 w-full justify-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => arboristRef.current?.expandAll()}
            >
              {t("common:expand_all")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => arboristRef.current?.collapseAll()}
            >
              {t("common:collapse_all")}
            </Button>
          </div>

          <div className="flex flex-col gap-1 w-full">
            <Label htmlFor="chapter-search">{t("common:search")}</Label>
            <Input
              id="chapter-search"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchTerm(e.target.value)
              }
              placeholder={t("book:chapter_search_term_placeholder")}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div>
        <Separator className="mb-2 md:hidden" />

        <ChapterArborist
          ref={arboristRef}
          bookTocTree={bookTocTree}
          treeIndent={0}
          tHeight={height}
          searchTerm={searchTerm}
          bookUnitId={bookId}
          selectedId={String(selectedId)}
          width={width}
          baseLink={baseLink}
        />
      </div>
    </div>
  );
};
