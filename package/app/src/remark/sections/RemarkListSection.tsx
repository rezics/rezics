import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { common_loading } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RemarkList } from "../components/list/RemarkList";

const i18nMessages = {
  common_loading,
};

interface RemarkListSectionProps {
  targetUnitId: string;
  workUnitId?: string;
  limit?: number;
}

export const RemarkListSection: React.FC<RemarkListSectionProps> = ({
  targetUnitId,
  workUnitId,
  limit = 20,
}) => {
  const m = useMessage(i18nMessages);
  const { data, isLoading, error } = useQuery({
    ...postQueries.list(
      workUnitId
        ? {
            workUnitId,
            kind: PostKind.REMARK,
            workRoles: ["POST"],
            limit,
          }
        : { targetUnitId, kind: PostKind.REMARK, limit },
    ),
    enabled: !!targetUnitId,
  });

  if (isLoading) return <div>{m.common_loading()}</div>;
  if (error) return <QueryErrorDisplay error={error} />;

  const posts = data?.posts ?? [];
  return <RemarkList posts={posts} />;
};
