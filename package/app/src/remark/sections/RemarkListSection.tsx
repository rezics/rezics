import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RemarkList } from "../components/list/RemarkList";
import { useMessage } from "@rezics/i18n/react";
import { common_loading } from "@rezics/i18n/messages";
const i18nMessages = {
  common_loading,
};

interface RemarkListSectionProps {
  targetUnitId: string;
  limit?: number;
}

export const RemarkListSection: React.FC<RemarkListSectionProps> = ({
  targetUnitId,
  limit = 20,
}) => {
  const m = useMessage(i18nMessages);
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(targetUnitId, { kind: PostKind.REMARK, limit }),
    enabled: !!targetUnitId,
  });

  if (isLoading) return <div>{m.common_loading()}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const posts = data?.posts ?? [];
  return <RemarkList posts={posts} />;
};
