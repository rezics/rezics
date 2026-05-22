import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { Collapsible } from "@rezics/ui/primitive/typography/collapsible/Collapsible.tsx";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";

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
  const { t } = useTranslation();

  if (clamp) {
    return (
      <Collapsible
        maxLines={clamp.maxLines}
        showMoreLabel={t("common.expand")}
        showLessLabel={t("common.collapse")}
      >
        <MarkdownContent content={body ?? ""} className={className} />
      </Collapsible>
    );
  }

  return <MarkdownContent content={body ?? ""} className={className} />;
};
