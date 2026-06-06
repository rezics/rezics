import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import type { FC } from "react";

interface DescriptionBoxProps {
  content: string;
}

export const DescriptionBox: FC<DescriptionBoxProps> = ({ content }) => {
  return (
    <div className="relative border border-gray-200 rounded-lg pt-12 pb-6 px-6 bg-white">
      <div className="absolute -top-2.5 left-4 bg-white px-2">
        <span className="text-xs font-mono text-gray-500 tracking-wide">
          DESCRIPTION.md
        </span>
      </div>
      <MarkdownContent content={content} className="markdown-body" />
    </div>
  );
};
