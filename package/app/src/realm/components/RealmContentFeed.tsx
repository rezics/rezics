import Box from "@mui/material/Box";
import { postQueries } from "@rezics/api/post/post";
import { EmptyState } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { PostCard } from "@/post";

interface RealmContentFeedProps {
  realmId: string;
}

export const RealmContentFeed: React.FC<RealmContentFeedProps> = ({
  realmId,
}) => {
  const { t } = useTranslation();
  const { data } = useQuery(postQueries.byTarget(realmId));
  const posts = data?.posts ?? [];

  if (posts.length === 0) {
    return <EmptyState title={t("realm.content.empty.title")} />;
  }

  return (
    <Box>
      {posts.map((post) => (
        <PostCard key={post.unitId} post={post} />
      ))}
    </Box>
  );
};
