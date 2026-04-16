import { Alert } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import type { ChapterTreeItem } from "@rezics/contract";
import { RezicsJsonEditor } from "@rezics/ui/editor";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { QueryErrorDisplay } from "@/core/component/QueryErrorDisplay";

/** Props for ChapterTreeJsonEditor component. */
interface ChapterTreeJsonEditorProps {
  /** Book unit ID. */
  bookId: string;
}

/** JSON structure for chapter tree editor. */
type ChapterTreeJsonData = {
  index: ChapterTreeItem[];
};

/**
 * Chapter Tree JSON Editor - Raw JSON editor for chapter tree.
 *
 * Note: This feature is currently disabled.
 */
export const ChapterTreeJsonEditor: React.FC<ChapterTreeJsonEditorProps> = ({
  bookId,
}) => {
  const { data, isLoading, error } = useQuery(bookQueries.chapterIndex(bookId));

  const [jsonData, setJsonData] = useState<ChapterTreeJsonData>({ index: [] });

  useEffect(() => {
    setJsonData({
      index: data?.index ?? [],
    });
  }, [data]);

  function onChange(value: ChapterTreeJsonData) {
    console.log(value);
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <div>
      <Alert severity="error" className="mb-2">
        该功能暂未启用
      </Alert>
      <RezicsJsonEditor
        value={JSON.stringify(jsonData, null, 2)}
        onChange={(text) => {
          try {
            onChange(JSON.parse(text));
          } catch {
            // Invalid JSON
          }
        }}
      />
    </div>
  );
};
