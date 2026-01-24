import { JsonEditorLight } from '@/component/Form/JsonEditorLight';
import { useQuery } from '@tanstack/react-query';
import { bookQueries } from '@/api/book/book';
import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';

interface ChapterTreeJsonEditorProps {
  bookId: string;
}

export function ChapterTreeJsonEditor({ bookId }: ChapterTreeJsonEditorProps) {
  const { data, isLoading, error } = useQuery(bookQueries.chapterIndex(bookId));

  const [jsonData, setJsonData] = useState<any>({});

  useEffect(() => {
    setJsonData({
      index: data?.index ?? [],
    });
  }, [data]);

  function onChange(value: any) {
    console.log(value);
  }
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Oh no... {String(error as any)}</div>;
  return (
    <div>
      <Alert severity="error" className="mb-2">
        该功能暂未启用
      </Alert>
      <JsonEditorLight value={jsonData} onChange={onChange} />
    </div>
  );
}
