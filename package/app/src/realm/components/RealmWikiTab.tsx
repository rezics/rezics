import { postQueries } from "@rezics/api/post/post";
import type { RealmDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import { StreamPostCard } from "@/stream";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { RealmSidebar } from "../sections/RealmSidebar";

interface RealmWikiTabProps {
  realm: RealmDTO;
  realmId: string;
}

export function RealmWikiTab({ realm, realmId }: RealmWikiTabProps) {
  const { t } = useTranslation(["common", "entity", "zone"]);
  const readContext = useReadLanguageContext();
  const wikiPostsQuery = useQuery({
    ...postQueries.wikiByRealm(realmId, {
      sort: { field: "updatedAt", order: "desc" },
      languages: readContext.languages,
      appLocale: readContext.appLocale,
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
              <StreamPostCard key={post.unitId} post={post} />
            ))}
          </div>
        )}
      </div>

      <aside className="min-w-0">
        <RealmSidebar realm={realm} placement="wiki" />
      </aside>
    </div>
  );
}
