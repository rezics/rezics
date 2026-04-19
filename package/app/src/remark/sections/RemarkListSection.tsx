import { Typography } from "@mui/material";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RemarkList } from "../components/list/RemarkList";

interface RemarkListSectionProps {
  targetUnitId: string;
  limit?: number;
}

export const RemarkListSection: React.FC<RemarkListSectionProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(targetUnitId, { kind: PostKind.REMARK, limit }),
    enabled: !!targetUnitId,
  });

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const posts = data?.posts ?? [];
  if (posts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" py={2}>
        No remarks yet.
      </Typography>
    );
  }

  return <RemarkList posts={posts} />;
};
