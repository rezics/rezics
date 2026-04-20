import { Stack } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useTranslation } from "react-i18next";
import { RemarkCard } from "../item/RemarkCard";

interface RemarkListProps {
  posts: PostDTO[];
  spacing?: number | string;
}

export const RemarkList: React.FC<RemarkListProps> = ({
  posts,
  spacing = 2,
}) => {
  const { t } = useTranslation();

  if (posts.length === 0) {
    return <EmptyState title={t("remark.list.empty.title")} />;
  }

  return (
    <Stack spacing={spacing}>
      {posts.map((post) => (
        <RemarkCard key={post.unitId} remark={post} />
      ))}
    </Stack>
  );
};
