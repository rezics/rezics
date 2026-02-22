import MarkdownIt from 'markdown-it';
import {preserveFormattingPlugin} from '@/editor/plugin/preserveFormatPlugin';

export function MarkdownContent({content}: {content: string}) {
  const md = new MarkdownIt({
    html: false,
    // html: true,
    linkify: true,
    breaks: true, // key: convert \n to <br>
    typographer: true,
  });

  md.use(preserveFormattingPlugin);

  const chapterHtml = md.render(content || '');

  return <div dangerouslySetInnerHTML={{__html: chapterHtml}} />;
}
