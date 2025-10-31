import {useQuery} from '@tanstack/react-query';
import {chapterDetailQuery} from '@/api/chapter/chapter';
import {preserveFormattingPlugin} from '@/component/Form/preserveFormatPlugin.ts';
import MarkdownIt from 'markdown-it';
import React from 'react';

export const BookReadChapterPage: React.FC<{chapterId: string}> = ({
  chapterId,
}) => {
  const {data, isPending, error, isError} = useQuery(
    chapterDetailQuery(chapterId),
  );

  const md = new MarkdownIt({
    html: false,
    // html: true,
    linkify: true,
    breaks: true, // key: convert \n to <br>
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
    <div>
      <div className="w-11/12 mx-auto">
        <div id="markdown-chapter-content" className="markdown-body p-4">
          <div dangerouslySetInnerHTML={{__html: chapterHtml}} />
        </div>
      </div>
    </div>
  );
};
