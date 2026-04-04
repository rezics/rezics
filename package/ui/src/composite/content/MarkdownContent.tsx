import {createNovelRenderer} from '@rezics/editor/markdown';

export function MarkdownContent({content}: {content: string}) {
  const md = createNovelRenderer();
  const chapterHtml = md.render(content || '');

  return <div dangerouslySetInnerHTML={{__html: chapterHtml}} />;
}
