import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Collapsible } from "@rezics/ui/primitive/typography/collapsible/Collapsible.tsx";
import type React from "react";
import * as m from "@rezics/i18n/messages";

interface PostBodyMarkdownProps {
  body: string;
  clamp?: { maxLines: number } | false;
  className?: string;
}

export const PostBodyMarkdown: React.FC<PostBodyMarkdownProps> = ({
  body,
  clamp,
  className,
}) => {
  if (clamp) {
    return (
      <Collapsible
        maxLines={clamp.maxLines}
        showMoreLabel={m.common_expand()}
        showLessLabel={m.common_collapse()}
      >
        <MarkdownContent content={body ?? ""} className={className} />
      </Collapsible>
    );
  }

  return <MarkdownContent content={body ?? ""} className={className} />;
};
