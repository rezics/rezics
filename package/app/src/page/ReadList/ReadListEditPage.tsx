import React, { useEffect } from 'react';
import { useState } from 'react';
import { buildMeiliUnitQuery } from '@/api/meili/meili.queries';
import { UnitType } from '@package/contract';
import {
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import { ArrowDownward, ArrowUpward, Delete } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  readlistQueries,
  useDeleteReadlistMutation,
  useUpdateReadlistMutation,
} from '@/api/readlist/readlist';
import { reviewQueries } from '@/api/review/review';
import { BookReviewGroup } from '@/component/ReadList/Review.tsx';
import { bookQueries } from '@/api/book/book';
import { useNavigate } from '@tanstack/react-router';
import { ConfirmDeleteDialog } from '@/component/Form/ConfirmDeleteDialog';
import { useAlertStore } from '@/global/windowAlertStore';
import { mapUnitListToReviewListResponse } from '@/api/meili/meili.api';
import { useTranslation } from 'react-i18next';
import { readlistEditRoute } from '@/router';

function extractReviewId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Match /review/:unitId from absolute or relative URL
  const m = trimmed.match(/(?:https?:\/\/[^/]+)?\/review\/([A-Za-z0-9-]+)/i);
  if (m?.[1]) return m[1];
  // Fallback: UUID-like string or any non-space token
  const token = trimmed.match(/[A-Za-z0-9-]{8,}/)?.[0];
  return token || null;
}

const PasteReviewUrlInput: React.FC<{
  onAdd: (id: string) => void;
}> = ({ onAdd }) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const id = extractReviewId(input);
    if (id) {
      onAdd(id);
      setInput('');
    }
  };

  return (
    <div className="flex items-end gap-3">
      <TextField
        fullWidth
        label={t('page.readlist.paste_review_input_label')}
        variant="standard"
        value={input}
        onChange={e => setInput(e.target.value)}
      />
      <Button variant="contained" onClick={handleAdd}>
        {t('page.readlist.add_button')}
      </Button>
    </div>
  );
};

const ReviewSearchBox: React.FC<{
  onAdd: (id: string) => void;
}> = ({ onAdd }) => {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery(
    buildMeiliUnitQuery(
      UnitType.REVIEW,
      0,
      '',
      q,
      5,
      mapUnitListToReviewListResponse,
    ),
  );
  const reviews = data?.reviews ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <TextField
          fullWidth
          label={t('page.readlist.search_review_label')}
          variant="standard"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const k = keyword.trim();
              if (k) setQ(k);
            }
          }}
        />

        <Button
          variant="outlined"
          onClick={() => setQ(keyword.trim())}
          disabled={!keyword.trim()}
        >
          {t('page.readlist.search_button')}
        </Button>
      </div>

      <Stack spacing={1}>
        {isLoading && (
          <div className="text-sm text-gray-500">
            {t('page.readlist.searching')}
          </div>
        )}
        {!isLoading &&
          reviews?.slice(0, 5).map((rv: any) => (
            <Paper
              key={rv.unitId}
              variant="outlined"
              className="p-2 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {rv.title || t('page.readlist.untitled')}{' '}
                  <span className="text-gray-500">#{rv.unitId}</span>
                </div>
                <div className="text-xs text-gray-600 line-clamp-1">
                  {rv.content}
                </div>
              </div>
              <Button size="small" onClick={() => onAdd(rv.unitId)}>
                {t('page.readlist.add_button')}
              </Button>
            </Paper>
          ))}
      </Stack>
    </div>
  );
};

const ReviewItemRow: React.FC<{
  reviewId: string;
  bookData: any;
  reviewData: any;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}> = ({ reviewId, bookData, reviewData, onRemove, onMoveUp, onMoveDown }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col gap-1">
        <Tooltip title={t('page.readlist.move_up')}>
          <span>
            <IconButton size="small" onClick={() => onMoveUp(reviewId)}>
              <ArrowUpward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('page.readlist.move_down')}>
          <span>
            <IconButton size="small" onClick={() => onMoveDown(reviewId)}>
              <ArrowDownward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('common.delete')}>
          <span>
            <IconButton
              size="small"
              color="error"
              onClick={() => onRemove(reviewId)}
            >
              <Delete fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </div>
      <div className="flex-1">
        <BookReviewGroup book={bookData} review={reviewData} className="mt-2" />
      </div>
    </div>
  );
};

export const ReadListEditor: React.FC<{
  header?: React.ReactNode;
  readlistData: any;
  setReadlistData: (data: any) => void;
}> = ({ header, readlistData, setReadlistData }) => {
  const { t } = useTranslation();
  useEffect(() => {
    console.log('readlistData update', readlistData);
  }, [readlistData]);

  function updateReviewIds(ids: string[]) {
    setReadlistData(prev => ({ ...prev, order: ids }));
  }

  const queryClient = useQueryClient();

  const addReviewId = async (id: string) => {
    // 触发 review 查询
    const review = await queryClient.fetchQuery(reviewQueries.detail(id));
    const reviewWithTargetUnitId = {
      ...review,
      targetUnitId: review.bookId,
    };

    // 触发 book 查询
    const book = await queryClient.fetchQuery(
      bookQueries.detail(review?.bookId),
    );

    setReadlistData(prev => ({
      ...prev,
      books: [...prev.books, book],
      reviews: [...prev.reviews, reviewWithTargetUnitId],
      order: [...(prev.order ?? []), id],
    }));
  };
  const removeReviewId = (id: string) => {
    updateReviewIds(readlistData.order?.filter(x => x !== id) ?? []);
  };
  const moveUp = (id: string) => {
    const idx = readlistData.order?.indexOf(id);
    if (idx <= 0) return;
    const next = readlistData.order?.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    updateReviewIds(next);
  };
  const moveDown = (id: string) => {
    const idx = readlistData.order?.indexOf(id);
    if (idx < 0 || idx >= readlistData.order?.length - 1) return;
    const next = readlistData.order?.slice();
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    updateReviewIds(next);
  };

  return (
    <div className="w-full max-w-4xl mt-[60px] mx-auto">
      {header}

      <div className="space-y-6">
        <Paper variant="outlined" className="p-4 space-y-4">
          <div className="text-lg font-semibold">
            {t('page.readlist.meta_info')}
          </div>
          <TextField
            label={t('page.readlist.title_label')}
            className="w-full"
            variant="standard"
            value={readlistData?.title}
            onChange={e =>
              setReadlistData(prev => ({ ...prev, title: e.target.value }))
            }
          />
          <div className="mt-2" />
          <TextField
            label={t('page.readlist.summary_label')}
            variant="standard"
            className="w-full"
            value={readlistData?.content}
            onChange={e =>
              setReadlistData(prev => ({ ...prev, content: e.target.value }))
            }
          />
          <TextField
            label={t('page.readlist.cover_label')}
            variant="standard"
            className="w-full"
            value={readlistData?.coverUrl}
            onChange={e =>
              setReadlistData(prev => ({ ...prev, coverUrl: e.target.value }))
            }
          />
        </Paper>
        <Paper variant="outlined" className="p-4 space-y-4">
          <div className="text-lg font-semibold">
            {t('page.readlist.add_review')}
          </div>
          <PasteReviewUrlInput onAdd={addReviewId} />
          <ReviewSearchBox onAdd={addReviewId} />
        </Paper>

        <Paper variant="outlined" className="p-4 space-y-4">
          <div className="text-lg font-semibold">
            {t('page.readlist.current_reviews_title')}
          </div>
          <Stack spacing={3}>
            {readlistData?.order?.length === 0 && (
              <div className="text-sm text-gray-500">
                {t('page.readlist.no_reviews_small')}
              </div>
            )}
            {readlistData?.order?.map(unitId => {
              const reviewData = readlistData?.reviews.find(
                r => r.unitId === unitId,
              );
              const bookData = readlistData?.books.find(
                b => b.unitId === reviewData?.targetUnitId,
              );
              if (!bookData || !reviewData) return null;
              return (
                <ReviewItemRow
                  key={unitId}
                  reviewId={unitId}
                  bookData={bookData}
                  reviewData={reviewData}
                  onRemove={removeReviewId}
                  onMoveUp={moveUp}
                  onMoveDown={moveDown}
                />
              );
            })}
          </Stack>
        </Paper>
      </div>
    </div>
  );
};

export function ReadListEditPage() {
  const { readlistId } = readlistEditRoute.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(readlistQueries.detail(readlistId || ''));
  type ReadlistData = typeof data;
  const { t } = useTranslation();

  const updateReadlistMutation = useUpdateReadlistMutation();

  const [readlistData, setReadlistData] = useState<any>(data);
  useEffect(() => {
    if (data) {
      setReadlistData(data);
    }
  }, [data]);

  function handleSubmit(data: ReadlistData) {
    // 将 books 转换成 Prisma connect 格式
    const bookConnect = (data?.books ?? []).filter(Boolean).map(b => b.unitId);

    // 将 reviews 转换成 Prisma connect 格式
    const reviewConnect = (data?.reviews ?? [])
      .filter(Boolean)
      .map(r => r.unitId);

    console.log('bookConnect', bookConnect);
    console.log('reviewConnect', reviewConnect);

    // 排序字段：直接传字符串数组
    const order = data?.order ?? [];

    updateReadlistMutation.mutate(
      {
        unitId: readlistId,
        input: {
          title: data?.title ?? undefined,
          content: data?.content ?? undefined,
          coverUrl: data?.coverUrl ?? undefined,

          // Prisma connect 必须传数组
          book: bookConnect.length > 0 ? bookConnect : undefined,
          review: reviewConnect.length > 0 ? reviewConnect : undefined,
          order: order.length > 0 ? order : undefined,
        },
      },
      {
        onSuccess: () => {
          useAlertStore.getState().show(t('page.readlist.update_success'));
        },
        onError: error => {
          useAlertStore.getState().show(String(error));
        },
      },
    );
  }

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const deleteReadlistMutation = useDeleteReadlistMutation();
  const handleDelete = () => {
    deleteReadlistMutation.mutate(readlistId, {
      onSuccess: () => {
        console.log(t('page.readlist.delete_success'));
        navigate({ to: `/readlist` });
      },
      onError: error => {
        console.error(t('page.readlist.delete_failed'), error);
      },
    });
    setDeleteDialogOpen(false);
  };

  const header = (
    <div className="mb-4">
      <div className="flex items-center">
        <div className="text-2xl font-bold">
          {t('page.readlist.edit_readlist')}
        </div>
        <div className="ml-auto">
          <Button
            variant="outlined"
            color="primary"
            className="!mr-2"
            onClick={() => navigate({ to: `/readlist/${readlistId}` })}
          >
            {t('common.back')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleSubmit(readlistData)}
          >
            {t('common.submit')}
          </Button>
        </div>
      </div>
      {isLoading && (
        <div className="text-sm text-gray-500 mt-1">{t('common.loading')}</div>
      )}
    </div>
  );

  return (
    <div>
      <ReadListEditor
        header={header}
        readlistData={readlistData}
        setReadlistData={setReadlistData}
      />
      <div className="mt-4 max-w-4xl mx-auto mb-8">
        <Button
          className="w-full"
          variant="contained"
          color="primary"
          onClick={() => setDeleteDialogOpen(true)}
        >
          {t('common.delete')}
        </Button>
        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          onSubmit={handleDelete}
        />
      </div>
    </div>
  );
}

export default ReadListEditPage;
