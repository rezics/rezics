import React, {useEffect, useState} from 'react';
import {JsonEditorLight} from '@rezics/ui/editor/jsoneditor/JsonEditorLight.tsx';
import {useQuery} from '@tanstack/react-query';
import {bookQueries} from '@rezics/api/book/book';
import {Alert} from '@mui/material';
import type {ChapterTreeItem} from '@rezics/contract';

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
  const {data, isLoading, error} = useQuery(bookQueries.chapterIndex(bookId));

  const [jsonData, setJsonData] = useState<ChapterTreeJsonData>({index: []});

  useEffect(() => {
    setJsonData({
      index: data?.index ?? [],
    });
  }, [data]);

  function onChange(value: ChapterTreeJsonData) {
    console.log(value);
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Oh no... {String(error)}</div>;

  return (
    <div>
      <Alert severity="error" className="mb-2">
        该功能暂未启用
      </Alert>
      <JsonEditorLight value={jsonData} onChange={onChange} />
    </div>
  );
};
