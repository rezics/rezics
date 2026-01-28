import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Divider, Switch, TextField, Button, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { bookQueries } from '@package/api/book/book.queries';
import { ChapterArborist } from '@/component/Book/Chapter/ChapterArborist';
import type { ChapterArboristRefHandle } from '@/component/Book/Chapter/ChapterArborist';

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
  const { t } = useTranslation();
  // Data fetching
  const { data, isLoading, error } = useQuery(bookQueries.chapterIndex(bookId));

  const selectedId = chapterId || '';
  const baseLink = bookId ? `/book/${bookId}/edit` : '';

  const chapterTree: any = useMemo(
    () =>
      data?.index ?? [],
    [data],
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [enableDrag, setEnableDrag] = useState(false);
  const [enableRename, setEnableRename] = useState(enableDoubleClickRename);
  const arboristRef = useRef<ChapterArboristRefHandle | null>(null);

  if (!bookId) return null;
  if (isLoading) return <div>{t('common.loading')}</div>;
  if (error)
    return (
      <div>
        {t('common.error_generic')} {String(error as any)}
      </div>
    );
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
                {t('common.expand_all')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => arboristRef.current?.collapseAll()}
              >
                {t('common.collapse_all')}
              </Button>
            </Stack>

            <TextField
              id="chapter-search"
              label={t('common.search')}
              variant="standard"
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              placeholder={t('placeholders.enter_search_term')}
              className="w-full"
            />

            {isEdit && (
              <div className="space-y-3 mt-2">
                <div className="flex items-center space-x-4 w-full justify-between">
                  <div className="text-gray-700 font-bold">
                    {t('book.chapter.enable_drag')}
                  </div>
                  <Switch
                    checked={enableDrag}
                    onChange={(e: any) => setEnableDrag(e.target.checked)}
                  />
                </div>

                <div className="flex items-center space-x-4 w-full justify-between">
                  <div className="text-gray-700 font-bold">
                    {t('book.chapter.double_click_rename')}
                  </div>
                  <Switch
                    checked={enableRename}
                    onChange={(e: any) => setEnableRename(e.target.checked)}
                  />
                </div>
                <div>{t('book.chapter.rename_help')}</div>
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
