import { postQueries } from "@rezics/api/post/post";
import type { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Badge } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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

export const PostListSection: React.FC<PostListSectionProps> = ({
  targetUnitId,
  variantUnitId,
  currentCatalogEntryUnitId,
  targetVariantTitles = {},
  kind,
  limit = 20,
}) => {
  const { t } = useTranslation(["community"]);
  const navigate = useNavigate();
  const readContext = useReadLanguageContext();
  const query = postQueries.list({
    ...(variantUnitId
      ? { variantUnitId }
      : { targetUnitId: targetUnitId ?? "" }),
    kind,
    languages: readContext.languages,
    appLocale: readContext.appLocale,
    languageMode: readContext.languageMode,
    limit,
  });
  const { data, isLoading } = useQuery({
    ...query,
    enabled: readContext.ready && Boolean(variantUnitId || targetUnitId),
  });
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
                <Badge variant="outline">Variant: {targetVariantLabel}</Badge>
              </div>
            )}
            <FeedPostCard
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
