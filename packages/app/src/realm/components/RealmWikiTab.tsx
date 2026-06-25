import { postQueries } from "@rezics/contract/api/post/post.queries";
import type { RealmDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import { RealmDock } from "@/realm-dock";
import { StreamPostCard } from "@/stream";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

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
    <div className="flex min-w-0 flex-col gap-6">
      <RealmDock realm={realm} placement="wiki" variant="wiki" />
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
    </div>
  );
}
