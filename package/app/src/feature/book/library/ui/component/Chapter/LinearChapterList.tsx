import React, {useMemo, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Divider, TextField, Button, Stack} from '@mui/material';

import {bookQueries} from '@package/api/book/book.queries';
import {ChapterArborist} from './ChapterArborist';
import type {ChapterArboristRefHandle} from './ChapterArborist';
import type {ChapterTreeItem} from '@package/contract';

/** Props for LinearChapterList component. */
interface LinearChapterListProps {
  /** Width of the chapter list. */
  width?: number;
  /** Height of the chapter list. */
  height?: number;
  /** Book unit ID. */
  bookId: string;
  /** Currently selected chapter ID. */
  chapterId?: string;
  /** Whether in reading mode. */
  readingMode?: boolean;
}

/**
 * Linear Chapter List - Displays chapter tree using arborist.
 */
export const LinearChapterList: React.FC<LinearChapterListProps> = ({
  bookId,
  chapterId,
  width = 300,
  height = 300,
  readingMode = false,
}) => {
  const {data, isLoading, error} = useQuery(bookQueries.chapterIndex(bookId));

  const selectedId = chapterId || '';
  const baseLink = readingMode
    ? `/book/${bookId}/read`
    : bookId
    ? `/book/${bookId}/edit`
    : '';

  const chapterTree: ChapterTreeItem[] = useMemo(
    () => data?.index ?? [],
    [data],
  );

  const [searchTerm, setSearchTerm] = useState('');
  const arboristRef = useRef<ChapterArboristRefHandle | null>(null);

  if (!bookId) return null;
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Oh no... {String(error)}</div>;

  return (
    <div className="w-full">
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(e.target.value)
            }
            placeholder="Enter search term"
            className="w-full"
          />
        </div>
      </div>

      <div>
        <Divider className="mb-2 md:hidden" />

        <ChapterArborist
          ref={arboristRef}
          chapterTree={chapterTree}
          treeIndent={10}
          tHeight={height}
          searchTerm={searchTerm}
          bookUnitId={bookId}
          selectedId={String(selectedId)}
          width={width}
          baseLink={baseLink}
          readingMode={readingMode}
        />
      </div>
    </div>
  );
};
