import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { PostBodyMarkdown } from "@/post";
import { postQueries } from "@rezics/api/post/post";
import {
  mainMarkdownSource,
  type RealmDTO,
  type RealmMembershipMeDTO,
} from "@rezics/contract";
import { EmptyState, Spinner } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";

interface RealmAboutTabProps {
  realm: RealmDTO;
  description?: string;
  membership?: RealmMembershipMeDTO | null;
  canManage: boolean;
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
  const postQuery = useQuery({
    ...postQueries.detail(postUnitId ?? ""),
    enabled: Boolean(postUnitId),
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

export function RealmAboutTab({
  realm,
  description,
  membership,
  canManage,
}: RealmAboutTabProps) {
  const role = membership?.roleKey ?? "visitor";
  const state =
    membership?.state ?? (membership?.member ? "active" : "visitor");
  const visibility = realm.isPublic ? "Public" : "Member only";
  const moderatorContext = canManage
    ? "Moderation tools are available from this realm."
    : "Moderators manage reports, rules, and member safety for this realm.";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {description ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold leading-ui text-text-primary">
              Summary
            </h2>
            <p className="m-0 text-sm leading-body text-text-secondary">
              {description}
            </p>
          </section>
        ) : null}
        <RealmMarkdownPanel
          title="About"
          postUnitId={realm.extra?.about ?? null}
          emptyTitle="No about content"
        />
        <RealmMarkdownPanel
          title="Rules"
          postUnitId={realm.extra?.rule ?? null}
          emptyTitle="No realm rules"
        />
      </div>

      <aside className="flex min-w-0 flex-col gap-3">
        <InfoCard label="Members" value={String(realm.memberCount ?? 0)} />
        <InfoCard label="Visibility" value={visibility} />
        <InfoCard label="Your role" value={role} />
        <InfoCard label="Membership" value={state} />
        {realm.isOfficial ? <InfoCard label="Realm" value="Official" /> : null}
        <Card surface="contained">
          <CardContent className="p-4">
            <p className="m-0 text-xs font-medium uppercase leading-ui text-text-tertiary">
              Moderator context
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
