import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
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
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(targetUnitId, { kind: PostKind.REMARK, limit }),
    enabled: !!targetUnitId,
  });

  if (isLoading) return <div>{m.common_loading()}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const posts = data?.posts ?? [];
  return <RemarkList posts={posts} />;
};
