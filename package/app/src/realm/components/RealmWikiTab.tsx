import { postQueries } from "@rezics/api/post/post";
import { zoneByUnitIdQueryOptions } from "@rezics/api/zone/zone";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { Button, Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Settings } from "lucide-react";
import { PostCard } from "@/post";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { useReadLanguageCandidates } from "@/shared/hooks/useReadLanguageCandidates";

interface RealmWikiTabProps {
  realmId: string;
  wikiZoneUnitId?: string | null;
  canManage: boolean;
}

export function RealmWikiTab({
  realmId,
  wikiZoneUnitId,
  canManage,
}: RealmWikiTabProps) {
  const { t } = useTranslation(["common", "entity"]);
  const languages = useReadLanguageCandidates();
  const wikiPostsQuery = useQuery(
    postQueries.wikiByRealm(realmId, {
      sort: { field: "updatedAt", order: "desc" },
      languages,
      limit: 24,
    }),
  );
  const zoneQuery = useQuery(zoneByUnitIdQueryOptions(wikiZoneUnitId ?? ""));
  const posts = wikiPostsQuery.data?.posts ?? [];
  const zoneSlug = zoneQuery.data?.slug ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        {wikiPostsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm leading-ui text-text-secondary">
            <Spinner size="sm" />
            <span>{t("common:loading")}</span>
          </div>
        ) : wikiPostsQuery.error ? (
          <QueryErrorDisplay error={wikiPostsQuery.error} />
        ) : posts.length === 0 ? (
          <EmptyState title={t("entity:realm_content_empty_title")} />
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard key={post.unitId} post={post} />
            ))}
          </div>
        )}
      </div>

      <aside className="min-w-0">
        {wikiZoneUnitId ? (
          <Card surface="contained">
            <CardContent className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-medium leading-ui text-text-primary">
                  Wiki
                </h2>
                <p className="mt-1 text-sm leading-body text-text-secondary">
                  Realm Wiki entries can also be browsed through the configured
                  Zone.
                </p>
              </div>
              {zoneSlug ? (
                <Link to="/z/$slug" params={{ slug: zoneSlug }}>
                  <Button size="sm" className="w-full gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t("common:open")}
                  </Button>
                </Link>
              ) : (
                <Button size="sm" className="w-full" disabled>
                  {zoneQuery.isLoading ? t("common:loading") : t("common:open")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : canManage ? (
          <Card surface="contained">
            <CardContent className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-medium leading-ui text-text-primary">
                  Wiki setup
                </h2>
                <p className="mt-1 text-sm leading-body text-text-secondary">
                  Assign a Wiki Zone to turn this tab into a curated realm
                  homepage entry point.
                </p>
              </div>
              <Link to="/realm/$realmId/manage" params={{ realmId }}>
                <Button size="sm" variant="outline" className="w-full gap-2">
                  <Settings className="h-4 w-4" />
                  {t("entity:realm_manage")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </aside>
    </div>
  );
}
