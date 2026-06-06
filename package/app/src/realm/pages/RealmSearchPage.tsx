import {
  contentDocMarkdownFallback,
  markdownContentDoc,
  type RealmDTO,
  type RealmSearchDocument,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { KeywordInput } from "@/search/components/primitive";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { useLocalizedRealmSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { RealmCard } from "../components/RealmCard";

function mapRealmSearchDocToRealmDTO(doc: RealmSearchDocument): RealmDTO {
  return {
    unitId: doc.id,
    userId: doc.userId,
    isPublic: doc.isPublic,
    isOfficial: doc.isOfficial,
    memberCount: doc.memberCount,
    extra: doc.extra as any,
    resolvedLanguage: doc.resolvedLanguage,
    title: doc.title,
    description: doc.description
      ? markdownContentDoc(contentDocMarkdownFallback(doc.description))
      : undefined,
    translations: doc.translations.map((tr) => ({
      unitId: doc.id,
      language: tr.language,
      title: tr.title,
      description: markdownContentDoc(
        contentDocMarkdownFallback(tr.description),
      ),
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function RealmSearchPage() {
  const { t } = useTranslation(["entity"]);
  const search = useSearchQuery({});
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const { data, isLoading } = useLocalizedRealmSearch({
    keyword: keyword || undefined,
  });

  const realms = data?.items?.map(mapRealmSearchDocToRealmDTO) ?? [];
  const hasKeyword = keyword.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold">
        {t("entity:realm_search_title")}
      </h1>
      <div className="mb-6">
        <KeywordInput
          value={keywordBind.value ?? ""}
          onChange={(v) => keywordBind.onChange(v)}
          placeholder={t("entity:realm_search_placeholder")}
        />
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : hasKeyword && realms.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          {t("entity:realm_none_found")}
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
