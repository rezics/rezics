import { postQueries } from "@rezics/api/post/post";
import { zonePortalQueryOptions } from "@rezics/api/zone/zone";
import {
  mainMarkdownSource,
  type RealmWikiSidebar as RealmWikiSidebarConfig,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import { FeedPostCard } from "@/feed";
import { PostBodyMarkdown } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { pickZoneMenu, ZoneNavTree } from "@/zone";
import {
  realmDetailBaseHref,
  type RealmDetailRouteLocation,
} from "../models/realmDetailRoutes";

interface RealmWikiTabProps {
  realmId: string;
  routeLocation: RealmDetailRouteLocation;
  wikiSidebar?: RealmWikiSidebarConfig | null;
}

export function RealmWikiTab({
  realmId,
  routeLocation,
  wikiSidebar,
}: RealmWikiTabProps) {
  const { t } = useTranslation(["common", "entity", "zone"]);
  const readContext = useReadLanguageContext();
  const wikiPostsQuery = useQuery({
    ...postQueries.wikiByRealm(realmId, {
      sort: { field: "updatedAt", order: "desc" },
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 24,
    }),
    enabled: readContext.ready && Boolean(realmId),
  });
  const posts = wikiPostsQuery.data?.posts ?? [];

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
              <FeedPostCard key={post.unitId} post={post} />
            ))}
          </div>
        )}
      </div>

      <aside className="min-w-0">
        <RealmWikiSidebar
          routeLocation={routeLocation}
          sidebar={wikiSidebar}
          posts={posts}
          postsLoading={wikiPostsQuery.isLoading}
        />
      </aside>
    </div>
  );
}

function RealmWikiSidebar({
  routeLocation,
  sidebar,
  posts,
  postsLoading,
}: {
  routeLocation: RealmDetailRouteLocation;
  sidebar?: RealmWikiSidebarConfig | null;
  posts: Array<{ unitId: string; title?: string | null }>;
  postsLoading: boolean;
}) {
  if (sidebar?.kind === "post") {
    return <WikiPostSidebar postUnitId={sidebar.postUnitId} />;
  }
  if (sidebar?.kind === "zoneNav") {
    return (
      <WikiZoneNavSidebar
        zoneUnitId={sidebar.zoneUnitId}
        menuId={sidebar.menuId}
      />
    );
  }
  return (
    <WikiAutoListSidebar
      routeLocation={routeLocation}
      posts={posts}
      loading={postsLoading}
    />
  );
}

function WikiAutoListSidebar({
  routeLocation,
  posts,
  loading,
}: {
  routeLocation: RealmDetailRouteLocation;
  posts: Array<{ unitId: string; title?: string | null }>;
  loading: boolean;
}) {
  const { t } = useTranslation(["common"]);
  if (loading || posts.length === 0) return null;
  const baseHref = realmDetailBaseHref(routeLocation);
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-medium leading-ui text-text-primary">
          Wiki
        </h2>
        <ul className="flex flex-col gap-1">
          {posts.map((post) => (
            <li key={post.unitId}>
              <SafeLink
                href={`${baseHref}/post/${post.unitId}`}
                className="block rounded-md px-2 py-1.5 text-sm leading-ui text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
              >
                {post.title || t("common:untitled")}
              </SafeLink>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function WikiPostSidebar({ postUnitId }: { postUnitId: string }) {
  const readContext = useReadLanguageContext();
  const { data: post, isError } = useQuery({
    ...postQueries.detail(postUnitId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(postUnitId),
  });
  const markdown = mainMarkdownSource(post?.content);
  if (isError || !post || !markdown) return null;
  return (
    <Card surface="contained">
      <CardContent className="p-4">
        <PostBodyMarkdown
          content={post.content}
          className="text-sm leading-body text-text-secondary"
        />
      </CardContent>
    </Card>
  );
}

function WikiZoneNavSidebar({
  zoneUnitId,
  menuId,
}: {
  zoneUnitId: string;
  menuId?: string;
}) {
  const readContext = useReadLanguageContext();
  const zoneQuery = useQuery({
    ...zonePortalQueryOptions(zoneUnitId, "home", readContext.languages),
    enabled: readContext.ready && Boolean(zoneUnitId),
  });
  const data = zoneQuery.data;
  if (zoneQuery.isError || !data) return null;
  const menu = pickZoneMenu(data.zone.nav, menuId);
  if (!menu) return null;
  return (
    <Card surface="contained">
      <CardContent className="flex flex-col gap-3 p-4">
        <h2 className="text-sm font-medium leading-ui text-text-primary">
          {data.zone.name}
        </h2>
        <ZoneNavTree
          menu={menu}
          zoneSlug={data.zone.slug}
          pages={data.zone.pages}
          refUnits={data.refUnits}
        />
      </CardContent>
    </Card>
  );
}
