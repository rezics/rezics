import { useRealmSearchQuery } from "@rezics/api/meili/meili.queries";
import type { RealmDTO, RealmSearchDocument } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
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
      description: tr.description,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function RealmSearchPage() {
  const search = useSearchQuery({});
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const { data, isLoading } = useRealmSearchQuery({
    keyword: keyword || undefined,
  });

  const realms = data?.items?.map(mapRealmSearchDocToRealmDTO) ?? [];
  const hasKeyword = keyword.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">Search Realms</h1>
      <div className="mb-6">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          placeholder="Search realms..."
        />
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : hasKeyword && realms.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          No realms found
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

export default RealmSearchPage;
