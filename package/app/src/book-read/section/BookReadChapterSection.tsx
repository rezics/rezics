import {useQuery} from '@tanstack/react-query';
import {chapterDetailQuery} from '@rezics/api/chapter/chapter';
import {createNovelRenderer} from '@rezics/editor/markdown';
import React from 'react';
import {bookReadLayoutRoute} from '@/router';

export const BookReadChapterPage: React.FC = () => {
  const {chapterId} = bookReadLayoutRoute.useParams();
  const {data, isPending, error, isError} = useQuery(
    chapterDetailQuery(chapterId),
  );

  const md = createNovelRenderer();
  const chapterHtml = md.render(data?.content || '');

  if (isPending) return <div>Loading...</div>;
  if (isError)
    return (
      <div>
        Oh no...{' '}
        {error instanceof Error ? error.message : 'Failed to load chapter'}
      </div>
    );

  return (
    <div className="w-11/12 mx-auto p-4">
      <h1 className="text-2xl font-bold">{data?.title}</h1>
      <div id="markdown-chapter-content" className="markdown-body">
        <div dangerouslySetInnerHTML={{__html: chapterHtml}} />
      </div>
    </div>
  );
};
