import { postQueries } from "@rezics/api/post/post";
import type { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Badge } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { resolvePostTargetVariantLabel } from "@/book-library";
import { FeedPostCard } from "@/feed";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

interface PostListSectionProps {
  targetUnitId?: string;
  variantUnitId?: string;
  currentCatalogEntryUnitId?: string;
  targetVariantTitles?: Record<string, string>;
  kind?: PostKind;
  limit?: number;
}

/**
 * 帖子列表区块：展示指定目标或变体的帖子列表，支持分页加载
 * Post list section — displays a paginated list of posts for a target unit
 * or variant. Shows variant badges when applicable. Includes loading spinner
 * and empty state. Each post card is clickable to open detail view.
 *
 * Layout Structure:
 *
 * Mobile (<640px):
 *  +-----------+
 *  | Spinner   | (loading state)
 *  +-----------+
 *  | Empty msg | (if no posts)
 *  +-----------+
 *  | Post 1    |
 *  | Variant   |
 *  | Card      |
 *  +-----------+
 *  | Post 2    |
 *  | Card      |
 *  +-----------+
 *  | Post 3    |
 *  | Card      |
 *  +-----------+
 *
 * Tablet (640-1023px):
 *  +---------------+
 *  | Spinner       | (loading state)
 *  +---------------+
 *  | Empty message | (if no posts)
 *  +---------------+
 *  | Variant badge |
 *  | Post 1 Card   | (wider)
 *  +---------------+
 *  | Post 2 Card   |
 *  +---------------+
 *  | Post 3 Card   |
 *  +---------------+
 *
 * Desktop (1024-1535px):
 *  +-------------------+
 *  | Spinner           | (loading)
 *  +-------------------+
 *  | Empty message     | (if none)
 *  +-------------------+
 *  | Variant: Title    |
 *  | Post 1 (Card)     |
 *  +-------------------+
 *  | Post 2 (Card)     |
 *  +-------------------+
 *  | Post 3 (Card)     |
 *  +-------------------+
 *
 * Ultra-wide (>=1536px):
 *  +------------------------+
 *  | Spinner                | (loading)
 *  +------------------------+
 *  | Empty message          | (if none)
 *  +------------------------+
 *  | Variant: Title Badge   |
 *  | Post 1 (Full Card)     |
 *  +------------------------+
 *  | Post 2 (Full Card)     |
 *  +------------------------+
 *  | Post 3 (Full Card)     |
 *  +------------------------+
 */
export const PostListSection: React.FC<PostListSectionProps> = ({
  targetUnitId,
  variantUnitId,
  currentCatalogEntryUnitId,
  targetVariantTitles = {},
  kind,
  limit = 20,
}) => {
  const { t } = useTranslation(["community"]);
  const readContext = useReadLanguageContext();
  const query = postQueries.list({
    ...(variantUnitId
      ? { variantUnitId }
      : { targetUnitId: targetUnitId ?? "" }),
    kind,
    languages: readContext.languages,
    appLocale: readContext.appLocale,
    limit,
  });
  const { data, isLoading, error } = useQuery({
    ...query,
    enabled: readContext.ready && Boolean(variantUnitId || targetUnitId),
  });
  const posts = data?.posts ?? [];

  // Show spinner while loading or before query is enabled
  // 加载中或查询尚未启用时显示加载指示器
  if (isLoading || !readContext.ready) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-4 text-sm text-destructive">
        {t("community:discussion_load_failed")}
      </p>
    );
  }

  if (posts.length === 0) {
    return (
      <p className="py-4 text-sm text-text-secondary">
        {t("community:discussion_empty")}
      </p>
    );
  }

  return (
    <div>
      {posts.map((post) => {
        const targetVariantLabel = currentCatalogEntryUnitId
          ? resolvePostTargetVariantLabel(
              post,
              currentCatalogEntryUnitId,
              targetVariantTitles,
            )
          : undefined;
        return (
          <div key={post.unitId}>
            {targetVariantLabel && (
              <div className="pt-3">
                <Badge variant="outline">
                  {t("community:post_variant_badge", {
                    label: targetVariantLabel,
                  })}
                </Badge>
              </div>
            )}
            <FeedPostCard post={post} />
          </div>
        );
      })}
    </div>
  );
};
