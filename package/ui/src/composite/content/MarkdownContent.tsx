import { createRezicsRenderer } from "@rezics/editor/markdown";

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const md = createRezicsRenderer();
  const chapterHtml = md.render(content || "");

  return (
    <div
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering
      dangerouslySetInnerHTML={{ __html: chapterHtml }}
    />
  );
}
