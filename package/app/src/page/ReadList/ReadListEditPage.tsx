import React, {useEffect} from 'react';
import {useMemo, useState} from 'react';
import {
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
} from '@mui/material';
import {ArrowDownward, ArrowUpward, Delete} from '@mui/icons-material';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {
  readlistQueries,
  useDeleteReadlistMutation,
  useUpdateReadlistMutation,
} from '@/api/readlist/readlist';
import {reviewQueries} from '@/api/review/review';
import {BookReviewGroup} from '@/component/ReadList/Review.tsx';
import {bookQueries} from '@/api/book/book';
import {useLocation} from 'wouter';
import {ConfirmDeleteDialog} from '@/component/Form/ConfirmDeleteDialog';
import {useAlertStore} from '@/global/windowAlertStore';

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
}> = ({onAdd}) => {
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
        label="黏贴书评链接或ID（/review/:unitId）"
        variant="standard"
        value={input}
        onChange={e => setInput(e.target.value)}
      />
      <Button variant="contained" onClick={handleAdd}>
        添加
      </Button>
    </div>
  );
};

const ReviewSearchBox: React.FC<{
  onAdd: (id: string) => void;
}> = ({onAdd}) => {
  const [keyword, setKeyword] = useState('');
  const [q, setQ] = useState('');
  const {data, isLoading} = useQuery(reviewQueries.search(q));
  const reviews = data?.reviews ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <TextField
          fullWidth
          label="搜索书评（关键词）"
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
          搜索
        </Button>
      </div>

      <Stack spacing={1}>
        {isLoading && <div className="text-sm text-gray-500">搜索中...</div>}
        {!isLoading &&
          reviews?.slice(0, 5).map((rv: any) => (
            <Paper
              key={rv.unitId}
              variant="outlined"
              className="p-2 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {rv.title || '(无标题)'}{' '}
                  <span className="text-gray-500">#{rv.unitId}</span>
                </div>
                <div className="text-xs text-gray-600 line-clamp-1">
                  {rv.content}
                </div>
              </div>
              <Button size="small" onClick={() => onAdd(rv.unitId)}>
                添加
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
}> = ({reviewId, bookData, reviewData, onRemove, onMoveUp, onMoveDown}) => {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col gap-1">
        <Tooltip title="上移">
          <span>
            <IconButton size="small" onClick={() => onMoveUp(reviewId)}>
              <ArrowUpward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="下移">
          <span>
            <IconButton size="small" onClick={() => onMoveDown(reviewId)}>
              <ArrowDownward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="删除">
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
}> = ({header, readlistData, setReadlistData}) => {
  useEffect(() => {
    console.log('readlistData update', readlistData);
  }, [readlistData]);

  function updateReviewIds(ids: string[]) {
    setReadlistData(prev => ({...prev, order: ids}));
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
          <div className="text-lg font-semibold">元信息</div>
          <TextField
            label="书单名称"
            className="w-full"
            variant="standard"
            value={readlistData?.title}
            onChange={e =>
              setReadlistData(prev => ({...prev, title: e.target.value}))
            }
          />
          <div className="mt-2" />
          <TextField
            label="书单简介"
            variant="standard"
            className="w-full"
            value={readlistData?.content}
            onChange={e =>
              setReadlistData(prev => ({...prev, content: e.target.value}))
            }
          />
          <TextField
            label="书单封面"
            variant="standard"
            className="w-full"
            value={readlistData?.coverUrl}
            onChange={e =>
              setReadlistData(prev => ({...prev, coverUrl: e.target.value}))
            }
          />
        </Paper>
        <Paper variant="outlined" className="p-4 space-y-4">
          <div className="text-lg font-semibold">添加书评</div>
          <PasteReviewUrlInput onAdd={addReviewId} />
          <ReviewSearchBox onAdd={addReviewId} />
        </Paper>

        <Paper variant="outlined" className="p-4 space-y-4">
          <div className="text-lg font-semibold">
            当前书评（支持排序与删除）
          </div>
          <Stack spacing={3}>
            {readlistData?.order?.length === 0 && (
              <div className="text-sm text-gray-500">暂无书评</div>
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

export function ReadListEditPage({readlistId}: {readlistId: string}) {
  const [, navigate] = useLocation();
  const {data, isLoading} = useQuery(readlistQueries.detail(readlistId || ''));
  type ReadlistData = typeof data;

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
          useAlertStore.getState().show('书单更新成功');
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
        console.log('书单删除成功');
        navigate(`/readlist`);
      },
      onError: error => {
        console.error('书单删除失败', error);
      },
    });
    setDeleteDialogOpen(false);
  };

  const header = (
    <div className="mb-4">
      <div className="flex items-center">
        <div className="text-2xl font-bold">编辑书单</div>
        <div className="ml-auto">
          <Button
            variant="outlined"
            color="primary"
            className="!mr-2"
            onClick={() => navigate(`/readlist/${readlistId}`)}
          >
            返回
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleSubmit(readlistData)}
          >
            提交
          </Button>
        </div>
      </div>
      {isLoading && <div className="text-sm text-gray-500 mt-1">加载中...</div>}
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
          删除
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
