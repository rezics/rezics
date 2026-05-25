import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { RemarkList } from "@/remark";
import { useMessage } from "@rezics/i18n/react";
import { common_loading } from "@rezics/i18n/messages";
const m = {
  common_loading,
};

const i18nMessages = {
  common_loading,
};

interface ShortBookReviewsProps {
  bookId: string;
}

export const RemarkPreview: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
  const m = useMessage(i18nMessages);
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
