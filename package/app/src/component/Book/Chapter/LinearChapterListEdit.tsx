import React, {useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Divider, Switch, TextField, Button, Stack} from '@mui/material';

import {bookQueries} from '@/api/book/book.queries.ts';
import {ChapterArborist} from '@/component/Book/Chapter/ChapterArborist';
import type {ChapterArboristRefHandle} from '@/component/Book/Chapter/ChapterArborist';

import {buildTree} from '@/util/treeAbstract.ts';

interface LinearChapterListEditProps {
  width?: number;
  height?: number;
  isDraggable?: boolean;
  enableDoubleClickRename?: boolean;
  bookId: string;
  chapterId?: string;
  isEdit?: boolean;
}

export const LinearChapterListEdit: React.FC<LinearChapterListEditProps> = ({
  bookId,
  chapterId,
  width = 300,
  height = 300,
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

  if (!bookId) return null;
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Oh no... {String(error as any)}</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      <div className="md:col-span-1">
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
                <div>
                  修改此处的章节名称仅影响目录结构展示，不会更新实际章节标题。若需修改章节标题，请前往章节编辑页面，在那里修改标题后会自动更新目录结构。
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <Divider className="mb-2 md:hidden" />

        <ChapterArborist
          ref={arboristRef}
          chapterTree={chapterTree}
          tHeight={height}
          searchTerm={searchTerm}
          bookUnitId={bookId}
          selectedId={String(selectedId)}
          width={width}
          baseLink={baseLink}
          isEditable={isEdit}
          isDraggable={enableDrag}
          enableDoubleClickRename={isEdit && enableRename}
          showUpdateButton={true}
        />
      </div>
    </div>
  );
};
