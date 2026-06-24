import { createRezicsRenderer } from "@rezics/editor/markdown";
import { handleExternalLinkClick } from "../../link/handleExternalLinkClick";

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
    // biome-ignore lint/a11y/noStaticElementInteractions: delegated click handler only intercepts links in rendered markdown.
    // biome-ignore lint/a11y/useKeyWithClickEvents: markdown links remain keyboard-accessible as native anchors.
    <div
      className={`break-words ${className ?? ""}`}
      onClick={handleExternalLinkClick}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering
      dangerouslySetInnerHTML={{ __html: chapterHtml }}
    />
  );
}
