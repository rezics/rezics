import { postsByTargetQuery } from "@rezics/api/post/post";
import type { PostKind } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";
import { PostCard } from "../components/item/PostCard";

interface PostListSectionProps {
  targetUnitId: string;
  kind?: PostKind;
  limit?: number;
}

export const PostListSection: React.FC<PostListSectionProps> = ({
  targetUnitId,
  kind,
  limit = 20,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery(
    postsByTargetQuery(targetUnitId, {
      kind,
      limit,
      parentPostUnitId: undefined,
    }),
  );
  const posts = data?.posts ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-4">
        {t("discussion.empty", "No discussions yet.")}
      </p>
    );
  }

  return (
    <div>
      {posts
        .filter((post) => !post.parentPostUnitId)
        .map((post) => (
          <PostCard
            key={post.unitId}
            post={post}
            onOpen={() =>
              navigate({
                to: "/post/$rootPostUnitId",
                params: { rootPostUnitId: post.unitId },
              })
            }
          />
        ))}
    </div>
  );
};
