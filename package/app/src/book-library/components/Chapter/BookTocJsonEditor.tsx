import { bookQueries } from "@rezics/api/book/book";
import type { BookContentStructureItem } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { RezicsJsonEditor } from "@rezics/ui/editor";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { QueryErrorDisplay } from "@/core";

interface BookTocJsonEditorProps {
  /**
   * Book unit ID.
   * 书籍 unit ID。
   */
  bookId: string;
}

/**
 * JSON structure for the table-of-contents editor.
 * 目录编辑器使用的 JSON 结构。
 */
type BookTocJsonData = {
  nodes: BookContentStructureItem[];
};

/**
 * Raw JSON editor for the table of contents.
 * 目录的原始 JSON 编辑器。
 *
 * Note: This feature is currently disabled.
 * 注意：此功能目前处于禁用状态。
 */
export const BookTocJsonEditor: React.FC<BookTocJsonEditorProps> = ({
  bookId,
}) => {
  const { t } = useTranslation(["book", "common"]);
  const { data, isLoading, error } = useQuery(
    bookQueries.contentStructure(bookId),
  );

  const [jsonData, setJsonData] = useState<BookTocJsonData>({ nodes: [] });

  useEffect(() => {
    setJsonData({
      nodes: data?.nodes ?? [],
    });
  }, [data]);

  function onChange(value: BookTocJsonData) {
    console.log(value);
  }

  if (isLoading) return <div>{t("common:loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  return (
    <div>
      <Alert variant="destructive" className="mb-2">
        <AlertDescription>{t("book:toc_disabled")}</AlertDescription>
      </Alert>
      <RezicsJsonEditor
        value={JSON.stringify(jsonData, null, 2)}
        onChange={(text) => {
          try {
            onChange(JSON.parse(text));
          } catch {
            // Invalid JSON — swallow parse errors while the user is typing.
            // 无效的 JSON —— 用户输入过程中吞掉解析错误。
          }
        }}
      />
    </div>
  );
};
