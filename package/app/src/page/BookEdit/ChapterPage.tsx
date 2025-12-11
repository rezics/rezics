import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Button, CircularProgress, TextField} from '@mui/material';
import {useTranslation} from 'react-i18next';

import EasyEditor from '@/component/Form/EasyEditor.tsx';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {
  chapterDetailQuery,
  useUpdateChapterMutation,
} from '@/api/chapter/chapter';
import {bookMutations, bookChapterIndexQuery} from '@/api/book/book';

export interface BookEditChapterPageProps {
  chapterId: string;
  bookId: string;
}

/**
 * TODO 正常来说，所有的章节分卷管理都需要在这里解决，新增章节的时候选择分卷，或者删除章节。
 * @param param0
 * @returns
 */
export const BookEditChapterPage: React.FC<BookEditChapterPageProps> = ({
  chapterId,
  bookId,
}) => {
  const {t} = useTranslation();

  // Load chapter detail
  const {
    data,
    isPending: isLoading,
    isError,
    error,
  } = useQuery(chapterDetailQuery(chapterId));

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Initialize form state from fetched data
  useEffect(() => {
    if (data) {
      setTitle((data as any).title || '');
      setContent((data as any).content || '');
    }
  }, [data]);

  const updateMutation = useUpdateChapterMutation();
  const queryClient = useQueryClient();
  const updateChapterIndexMutation = bookMutations.useUpdateChapterIndex();

  const isDirty = useMemo(() => {
    if (!data) return false;
    const initialTitle = (data as any).title || '';
    const initialContent = (data as any).content || '';
    return initialTitle !== title || initialContent !== content;
  }, [data, title, content]);

  const isInvalid = useMemo(() => {
    return !title.trim() || !content.trim();
  }, [title, content]);

  const handleSubmit = useCallback(async () => {
    if (isInvalid) return;
    await updateMutation.mutateAsync({
      unitId: chapterId,
      input: {
        title,
        content,
      } as any,
    });
    const chapterIndex = await queryClient.fetchQuery(
      bookChapterIndexQuery(bookId),
    );
    if (chapterIndex) {
      console.log(chapterIndex);
      const order = chapterIndex?.index?.order;
      let chapters = chapterIndex?.index?.chapters;
      if (chapters) {
        chapters = Object.values(chapters).map((chapter: any) => {
          if (chapter.id === chapterId) {
            return {id: chapterId, title};
          }
          return chapter;
        });
      }
      updateChapterIndexMutation.mutateAsync({
        bookUnitId: bookId,
        chaptersIndex: {order, chapters},
      });
    }
  }, [
    isInvalid,
    updateMutation,
    chapterId,
    title,
    content,
    queryClient,
    updateChapterIndexMutation,
    bookId,
  ]);

  // Ctrl/Cmd+S to save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isSaveHotkey =
        (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
      if (isSaveHotkey) {
        e.preventDefault();
        if (!isInvalid && isDirty && !updateMutation.isPending) {
          handleSubmit();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInvalid, isDirty, updateMutation.isPending, handleSubmit]);

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center p-10">
        <CircularProgress size={24} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-xl mx-auto p-6 text-red-600">
        {(error as Error)?.message || 'Failed to load chapter'}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {t('chapter.edit_title', '编辑章节')}
        </h1>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isInvalid || !isDirty || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <span className="flex items-center gap-2">
              <CircularProgress size={16} /> {t('common.saving', '保存中...')}
            </span>
          ) : (
            t('common.submit')
          )}
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 shadow-sm p-4 bg-white">
        <div className="mb-4">
          <TextField
            id="chapter-title"
            label={t('chapter.title', '章节标题')}
            placeholder={t('placeholders.chapter_title')}
            multiline
            variant="filled"
            className="w-full"
            value={title}
            onChange={e => setTitle(e.target.value)}
            error={!title.trim()}
            helperText={!title.trim() ? t('validation.required', '必填') : ' '}
          />
        </div>
        <div className="min-h-[400px]">
          <EasyEditor value={content} onChange={setContent} />
          {!content.trim() && (
            <div className="text-sm text-red-600 mt-2">
              {t('validation.required', '必填')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
