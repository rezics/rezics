import { postQueries } from "@rezics/api/post/post";
import type { PostKind, PostListQuery } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Badge } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { resolvePostTargetReleaseLabel } from "@/book-library/models/communityFeed";
import { PostCard } from "../components/item/PostCard";

interface PostListSectionProps {
  targetUnitId?: string;
  workUnitId?: string;
  workRoles?: PostListQuery["workRoles"];
  currentReleaseUnitId?: string;
  targetReleaseTitles?: Record<string, string>;
  kind?: PostKind;
  limit?: number;
}

export const PostListSection: React.FC<PostListSectionProps> = ({
  targetUnitId,
  workUnitId,
  workRoles,
  currentReleaseUnitId,
  targetReleaseTitles = {},
  kind,
  limit = 20,
}) => {
  const { t } = useTranslation(["community"]);
  const navigate = useNavigate();
  const filters = {
    workRoles,
    kind,
    limit,
    parentPostUnitId: undefined,
  };
  const query = postQueries.list(
    workUnitId
      ? {
          workUnitId,
          ...filters,
        }
      : {
          targetUnitId: targetUnitId ?? "",
          kind,
          limit,
          parentPostUnitId: undefined,
        },
  );
  const { data, isLoading } = useQuery(query);
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
        {t("community:discussion_empty")}
      </p>
    );
  }

  return (
    <div>
      {posts
        .filter((post) => !post.parentPostUnitId)
        .map((post) => {
          const targetReleaseLabel = currentReleaseUnitId
            ? resolvePostTargetReleaseLabel(
                post,
                currentReleaseUnitId,
                targetReleaseTitles,
              )
            : undefined;
          return (
            <div key={post.unitId}>
              {targetReleaseLabel && (
                <div className="pt-3">
                  <Badge variant="outline">Target: {targetReleaseLabel}</Badge>
                </div>
              )}
              <PostCard
                post={post}
                onOpen={() =>
                  navigate({
                    to: "/post/$rootPostUnitId",
                    params: { rootPostUnitId: post.unitId },
                  })
                }
              />
            </div>
          );
        })}
    </div>
  );
};
