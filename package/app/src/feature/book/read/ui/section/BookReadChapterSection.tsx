import {useQuery} from '@tanstack/react-query';
import {chapterDetailQuery} from '@package/api/chapter/chapter';
import {preserveFormattingPlugin} from '@/component/Form/preserveFormatPlugin.ts';
import MarkdownIt from 'markdown-it';
import React from 'react';
import {bookReadLayoutRoute} from '@/router';

export const BookReadChapterPage: React.FC = () => {
  const {chapterId} = bookReadLayoutRoute.useParams();
  const {data, isPending, error, isError} = useQuery(
    chapterDetailQuery(chapterId),
  );

  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true,
    typographer: true,
  });

  md.use(preserveFormattingPlugin);

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

