import { createNovelRenderer } from "@rezics/editor/markdown";

export function MarkdownContent({ content }: { content: string }) {
  const md = createNovelRenderer();
  const chapterHtml = md.render(content || "");

  // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering
  return <div dangerouslySetInnerHTML={{ __html: chapterHtml }} />;
}
