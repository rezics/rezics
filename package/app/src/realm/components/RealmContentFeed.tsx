import { postQueries } from "@rezics/api/post/post";
import { EmptyState } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PostCard } from "@/post";
import type { RealmFeedSort } from "../sections/RealmFeedSortSwitcher";

interface RealmContentFeedProps {
  realmId: string;
  sort?: RealmFeedSort;
  tagIds?: string[];
}

export const RealmContentFeed: React.FC<RealmContentFeedProps> = ({
  realmId,
  sort = "new",
  tagIds = [],
}) => {
  const { t } = useTranslation();
  const { data } = useQuery(
    postQueries.byRealm(realmId, {
      sort,
      ...(tagIds.length > 0 ? { tagIds } : {}),
    }),
  );
  const posts = data?.posts ?? [];

  if (posts.length === 0) {
    return <EmptyState title={t("realm.content.empty.title")} />;
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.unitId} post={post} />
      ))}
    </div>
  );
};
