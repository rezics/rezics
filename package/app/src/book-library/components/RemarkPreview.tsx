import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RemarkList } from "@/remark";

interface ShortBookReviewsProps {
  bookId: string;
}

export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
  const { data, isLoading, error } = useQuery({
    ...postQueries.byTarget(bookId, { kind: PostKind.REMARK, limit: 4 }),
    enabled: !!bookId,
  });

  if (isLoading) {
    return <div>{m.common_loading()}</div>;
  }
  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  const posts = data?.posts?.slice(0, 4) ?? [];
  return <RemarkList posts={posts} />;
};
