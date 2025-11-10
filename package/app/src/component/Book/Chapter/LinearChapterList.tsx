import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Divider, Switch, TextField, Button, Stack} from '@mui/material';

import {bookQueries} from '@/api/book/book.queries.ts';
import {ChapterArborist} from '@/component/Book/Chapter/ChapterArborist';
import type {ChapterArboristRefHandle} from '@/component/Book/Chapter/ChapterArborist';

import {buildTree} from '@/util/treeAbstract.ts';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';

interface LinearChapterListProps {
  width?: number;
  height?: number;
  isDraggable?: boolean;
  enableDoubleClickRename?: boolean;
  bookId: string;
  chapterId?: string;
  isEdit?: boolean;
}

export const LinearChapterList: React.FC<LinearChapterListProps> = ({
  bookId,
  chapterId,
  width = 300,
  height = 300,
  isDraggable = false,
  enableDoubleClickRename = false,
  isEdit = false,
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

  const [searchTerm, setSearchTerm] = useState('');
  const [enableDrag, setEnableDrag] = useState(false);
  const [enableRename, setEnableRename] = useState(enableDoubleClickRename);
  const arboristRef = useRef<ChapterArboristRefHandle | null>(null);

  function updateChapter() {}

  if (!bookId) return null;
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Oh no... {String(error as any)}</div>;
  return (
    <div>
      <div className="mx-auto">
        <div className="space-y-4 mb-4 w-full pl-2 pr-2">
          <Stack direction="row" spacing={1} className="w-full justify-start">
            <Button
              variant="outlined"
              size="small"
              onClick={() => arboristRef.current?.expandAll()}
            >
              Expand All
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => arboristRef.current?.collapseAll()}
            >
              Collapse All
            </Button>
          </Stack>
          <TextField
            id="chapter-search"
            label="Search"
            variant="standard"
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            placeholder="Enter search term"
            className="w-full"
          />
          {isEdit && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center space-x-4 w-full justify-between">
                <div className="text-gray-700 font-bold">Enable Drag</div>
                <Switch
                  checked={enableDrag}
                  onChange={(e: any) => setEnableDrag(e.target.checked)}
                />
              </div>
              <div className="flex items-center space-x-4 w-full justify-between">
                <div className="text-gray-700 font-bold">
                  Double-click Rename
                </div>
                <Switch
                  checked={enableRename}
                  onChange={(e: any) => setEnableRename(e.target.checked)}
                />
              </div>
              <div className="flex items-center space-x-4 w-full justify-between">
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
                  onClick={updateChapter}
                >
                  Update Chapter
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Divider />

      <ChapterArborist
        ref={arboristRef}
        chapterTree={chapterTree}
        tHeight={height}
        searchTerm={searchTerm}
        selectedId={String(selectedId)}
        width={width}
        baseLink={baseLink}
        isEditable={isEdit}
        isDraggable={isEdit && isDraggable && enableDrag}
        enableDoubleClickRename={isEdit && enableRename}
      />
    </div>
  );
};
