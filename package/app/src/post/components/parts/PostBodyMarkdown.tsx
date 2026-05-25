import { mainMarkdownSource } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Collapsible } from "@rezics/ui/primitive/typography/collapsible/Collapsible.tsx";
import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import { common_collapse, common_expand } from "@rezics/i18n/messages";
const m = {
  common_collapse,
  common_expand,
};

const i18nMessages = {
  common_collapse,
  common_expand,
};

interface PostBodyMarkdownProps {
  content: unknown;
  clamp?: { maxLines: number } | false;
  className?: string;
}

export const PostBodyMarkdown: React.FC<PostBodyMarkdownProps> = ({
  content,
  clamp,
  className,
}) => {
  const m = useMessage(i18nMessages);
  const markdown = mainMarkdownSource(content) ?? "";

  if (clamp) {
    return (
      <Collapsible
        maxLines={clamp.maxLines}
        showMoreLabel={m.common_expand()}
        showLessLabel={m.common_collapse()}
      >
        <MarkdownContent content={markdown} className={className} />
      </Collapsible>
    );
  }

  return <MarkdownContent content={markdown} className={className} />;
};
