import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { PostDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useMemo } from "react";
import { RemarkCard } from "../item/RemarkCard";

const SPACING_CLASS_BY_NUMBER: Record<number, string> = {
  0: "gap-0",
  1: "gap-2",
  2: "gap-4",
  3: "gap-6",
  4: "gap-8",
};

interface RemarkListProps {
  posts: PostDTO[];
  spacing?: number | string;
}

export const RemarkList: React.FC<RemarkListProps> = ({
  posts,
  spacing = 2,
}) => {
  const { t } = useTranslation(["page"]);
const targetIds = useMemo(
    () => posts.map((p) => p.unitId).filter(Boolean) as string[],
    [posts],
  );
  useReactionHydration(targetIds);

  if (posts.length === 0) {
    return <EmptyState title={t("page:remark_list_empty_title")} />;
  }

  const gapClass =
    typeof spacing === "number"
      ? (SPACING_CLASS_BY_NUMBER[spacing] ?? "gap-4")
      : "gap-4";

  return (
    <div className={`flex flex-col ${gapClass}`}>
      {posts.map((post) => (
        <RemarkCard key={post.unitId} remark={post} />
      ))}
    </div>
  );
};
