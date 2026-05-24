import { useRealmSearchQuery } from "@rezics/api/meili/meili.queries";
import {
  markdownContentDoc,
  type RealmDTO,
  type RealmSearchDocument,
} from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import { RealmCard } from "../components/RealmCard";

function mapRealmSearchDocToRealmDTO(doc: RealmSearchDocument): RealmDTO {
  return {
    unitId: doc.id,
    userId: doc.userId,
    isPublic: doc.isPublic,
    isOfficial: doc.isOfficial,
    memberCount: doc.memberCount,
    extra: doc.extra as any,
    translations: doc.translations.map((tr) => ({
      unitId: doc.id,
      language: tr.language,
      title: tr.title,
      description: markdownContentDoc(tr.description ?? ""),
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function RealmListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useRealmSearchQuery({
    isPublic: true,
    sort: { field: "memberCount", order: "desc" },
    limit: 20,
  });

  const realms = data?.items?.map(mapRealmSearchDocToRealmDTO) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-row items-center justify-between">
        <h1 className="text-2xl font-semibold">{m.realm_list_title()}</h1>
        <div className="flex flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/realm/search" })}
          >
            {m.common_search()}
          </Button>
          <Button onClick={() => navigate({ to: "/realm/new" })}>
            {m.realm_new_title()}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : realms.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          {m.realm_empty_yet()}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {realms.map((realm) => (
            <RealmCard key={realm.unitId} realm={realm} />
          ))}
        </div>
      )}
    </div>
  );
}

export default RealmListPage;
