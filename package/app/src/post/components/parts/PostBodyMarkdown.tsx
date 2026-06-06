import { mainMarkdownSource } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Collapsible } from "@rezics/ui/primitive/typography/collapsible/Collapsible.tsx";
import type React from "react";

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
  const { t } = useTranslation(["common"]);
  const markdown = mainMarkdownSource(content) ?? "";

  if (clamp) {
    return (
      <Collapsible
        maxLines={clamp.maxLines}
        showMoreLabel={t("common:expand")}
        showLessLabel={t("common:collapse")}
      >
        <MarkdownContent content={markdown} className={className} />
      </Collapsible>
    );
  }

  return <MarkdownContent content={markdown} className={className} />;
};
