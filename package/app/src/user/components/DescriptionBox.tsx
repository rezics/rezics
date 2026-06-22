import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import type { FC } from "react";

interface DescriptionBoxProps {
  content: string;
}

export const DescriptionBox: FC<DescriptionBoxProps> = ({ content }) => {
  return (
    <div className="relative border border-border rounded-lg pt-12 pb-6 px-6 bg-surface-base">
      <div className="absolute -top-2.5 left-4 bg-surface-base px-2">
        <span className="text-xs font-mono text-text-secondary tracking-wide">
          DESCRIPTION.md
        </span>
      </div>
      <MarkdownContent content={content} className="markdown-body" />
    </div>
  );
};
