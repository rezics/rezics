import { postQueries } from "@rezics/api/post/post";
import { realmRuleResolvedQuery } from "@rezics/api/realm/realm";
import {
  mainMarkdownSource,
  type RealmDTO,
  type RealmMembershipMeDTO,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState, Spinner } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import { PostBodyMarkdown } from "@/post";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

interface RealmAboutTabProps {
  realm: RealmDTO;
  membership?: RealmMembershipMeDTO | null;
  canManage: boolean;
}

export function RealmAboutTab({
  realm,
  membership,
  canManage,
}: RealmAboutTabProps) {
  const { t } = useTranslation("entity");
  const role = membership?.roleKey ?? "visitor";
  const state =
    membership?.state ?? (membership?.member ? "active" : "visitor");
  const moderatorContext = canManage
    ? t("realm_about_moderator_has_tools")
    : t("realm_about_moderator_description");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <RealmMarkdownPanel
          title={t("realm_tab_about")}
          postUnitId={realm.extra?.about ?? null}
          emptyTitle={t("realm_about_no_content")}
        />
        <RealmRuleFullPanel realmUnitId={realm.unitId} />
      </div>

      <aside className="flex min-w-0 flex-col gap-3">
        <InfoCard label={t("realm_about_your_role")} value={role} />
        <InfoCard label={t("realm_about_membership")} value={state} />
        {realm.isOfficial ? (
          <InfoCard label={t("realm_title")} value={t("realm_official")} />
        ) : null}
        <Card surface="contained">
          <CardContent className="p-4">
            <p className="m-0 text-xs font-medium uppercase leading-ui text-text-tertiary">
              {t("realm_about_moderator_context")}
            </p>
            <p className="m-0 mt-2 text-sm leading-body text-text-secondary">
              {moderatorContext}
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function RealmMarkdownPanel({
  title,
  postUnitId,
  emptyTitle,
}: {
  title: string;
  postUnitId?: string | null;
  emptyTitle: string;
}) {
  const readContext = useReadLanguageContext();
  const postQuery = useQuery({
    ...postQueries.detail(postUnitId ?? "", {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready && Boolean(postUnitId),
  });

  if (!postUnitId) {
    return <EmptyState title={emptyTitle} />;
  }

  if (postQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (postQuery.isError) {
    return <QueryErrorDisplay error={postQuery.error} />;
  }

  if (!postQuery.data || !mainMarkdownSource(postQuery.data.content)) {
    return <EmptyState title={emptyTitle} />;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold leading-ui text-text-primary">
        {title}
      </h2>
      <PostBodyMarkdown
        content={postQuery.data.content}
        className="text-sm leading-body text-text-secondary"
      />
    </section>
  );
}

function RealmRuleFullPanel({ realmUnitId }: { realmUnitId: string }) {
  const { t } = useTranslation("entity");
  const readContext = useReadLanguageContext();
  const ruleQuery = useQuery({
    ...realmRuleResolvedQuery(realmUnitId, undefined, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const content =
    ruleQuery.data?.sourceRulePost?.content ??
    ruleQuery.data?.translation?.description ??
    null;

  if (ruleQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (ruleQuery.isError) {
    return <QueryErrorDisplay error={ruleQuery.error} />;
  }

  if (!content || !mainMarkdownSource(content)) {
    return <EmptyState title={t("realm_no_rules")} />;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold leading-ui text-text-primary">
        {t("realm_rules")}
      </h2>
      <PostBodyMarkdown
        content={content}
        className="text-sm leading-body text-text-secondary"
      />
    </section>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card surface="contained">
      <CardContent className="p-4">
        <p className="m-0 text-xs font-medium uppercase leading-ui text-text-tertiary">
          {label}
        </p>
        <p className="m-0 mt-2 text-sm font-medium leading-ui text-text-primary">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
