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
import {useParams} from 'wouter';
import {useQuery} from '@tanstack/react-query';

import {readlistQueries} from '@/api/readlist/readlist';
import {reviewQueries} from '@/api/review/review';
import {bookQueries} from '@/api/book/book';
import {BookReviewGroup} from '@/component/ReadList/Review.tsx';

type ReviewId = string;

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
              key={rv.id}
              variant="outlined"
              className="p-2 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {rv.title || '(无标题)'}{' '}
                  <span className="text-gray-500">#{rv.id}</span>
                </div>
                <div className="text-xs text-gray-600 line-clamp-1">
                  {rv.content}
                </div>
              </div>
              <Button size="small" onClick={() => onAdd(rv.id)}>
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
  data: any;
  initialReviewIds?: string[];
  header?: React.ReactNode;
}> = ({data, initialReviewIds = [], header}) => {
  const [reviewIds, setReviewIds] = useState<ReviewId[]>(initialReviewIds);
  useEffect(() => {
    setReviewIds(initialReviewIds);
  }, [initialReviewIds]);

  const addReviewId = (id: string) => {
    setReviewIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };
  const removeReviewId = (id: string) => {
    setReviewIds(prev => prev.filter(x => x !== id));
  };
  const moveUp = (id: string) => {
    setReviewIds(prev => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = prev.slice();
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };
  const moveDown = (id: string) => {
    setReviewIds(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = prev.slice();
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
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
            value={data.title}
            onChange={e => console.log(e.target.value)}
          />
          <div className="mt-2" />
          <TextField
            label="书单简介"
            variant="standard"
            className="w-full"
            value={data.content}
            onChange={e => console.log(e.target.value)}
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
            {reviewIds.length === 0 && (
              <div className="text-sm text-gray-500">暂无书评</div>
            )}
            {reviewIds.map(id => {
              console.log(id);
              const reviewData = data.reviews.find(r => r.unitId === id);
              const bookData = data.books.find(
                b => b.unitId === reviewData?.targetUnitId,
              );
              if (!bookData || !reviewData) return null;
              return (
                <ReviewItemRow
                  key={id}
                  reviewId={id}
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
  const {data, isLoading} = useQuery(readlistQueries.detail(readlistId || ''));
  const [initialIds, setInitialIds] = useState<string[]>([]);

  useEffect(() => {
    const reviews = (data?.reviews ?? []) as Array<any>;
    setInitialIds(reviews.map(r => r?.unitId).filter(Boolean));
  }, [data]);

  const header = (
    <div className="mb-4">
      <div className="flex items-center">
        <div className="text-2xl font-bold">编辑书单</div>
        <div className="ml-auto">
          <Button variant="contained" color="primary">
            提交
          </Button>
        </div>
      </div>
      {isLoading && <div className="text-sm text-gray-500 mt-1">加载中...</div>}
    </div>
  );

  return (
    <ReadListEditor
      initialReviewIds={initialIds}
      header={header}
      data={data ?? {books: [], reviews: []}}
    />
  );
}

export default ReadListEditPage;
