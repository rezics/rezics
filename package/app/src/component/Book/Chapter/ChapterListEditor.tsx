import React, {useEffect, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useRoute} from 'wouter';
import {Divider, Switch, TextField, Button} from '@mui/material';

import {bookQueries} from '@/api/book/book.queries.ts';
import {ChapterArborist} from '@/component/Book/Chapter/ChapterArborist';

import {buildTree} from '@/util/treeAbstract.ts';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';

interface ChapterListEditorProps {
  drawerWidth: number;
  isDraggable?: boolean;
  enableDoubleClickRename?: boolean;
  bookId: string;
  chapterId?: string;
}

export const ChapterListEditor: React.FC<ChapterListEditorProps> = ({
  bookId,
  chapterId,
  drawerWidth,
  isDraggable = false,
  enableDoubleClickRename = false,
}) => {
  // Data fetching
  const {data, isLoading, error} = useQuery(bookQueries.chapterIndex(bookId));

  const selectedId = chapterId || '';
  const baseLink = bookId ? `/book/${bookId}/edit` : '';

  const chapterTree: any = useMemo(
    () =>
      buildTree({
        nodes: data?.index?.chapters ?? [],
        orders: data?.index?.order ?? {},
      }),
    [data],
  );

  // UI state
  const {sidebarHeightBelow} = useLayoutStore();
  const [height, setHeight] = useState(sidebarHeightBelow);
  useEffect(() => {
    setHeight(sidebarHeightBelow);
  }, [sidebarHeightBelow]);

  const [searchTerm, setSearchTerm] = useState('');
  const [enableDrag, setEnableDrag] = useState(false);
  const dragInsurance = useMemo(
    () => enableDrag && isDraggable,
    [enableDrag, isDraggable],
  );

  function updataChapter() {}

  if (!bookId) return null;
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Oh no... {String(error as any)}</div>;

  return (
    <div>
      <div className="mx-auto">
        <div className="space-y-4 mb-6 w-full pl-6 pr-6">
          <TextField
            id="standard-basic"
            label="Search Term"
            variant="standard"
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            placeholder="Enter search term"
            className="w-full"
          />

          <div className="flex items-center space-x-4 mt-3 w-full justify-between">
            <div className="text-gray-700 font-bold">Enable Drag</div>
            <Switch
              checked={enableDrag}
              onChange={(e: any) => setEnableDrag(e.target.checked)}
            />
          </div>
          <div className="w-full">
            <Button
              variant="contained"
              color="primary"
              className="w-full"
              onClick={updataChapter}
            >
              Updata Chapter
            </Button>
          </div>
        </div>
      </div>
      <Divider />
      <ChapterArborist
        chapterTree={chapterTree}
        tHeight={height}
        searchTerm={searchTerm}
        selectedId={String(selectedId)}
        width={drawerWidth}
        baseLink={baseLink}
        isDraggable={dragInsurance}
        enableDoubleClickRename={enableDoubleClickRename}
      />
    </div>
  );
};
