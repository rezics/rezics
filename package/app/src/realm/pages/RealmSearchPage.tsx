import {
  contentDocMarkdownFallback,
  markdownContentDoc,
  type RealmDTO,
  type RealmSearchDocument,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { QueryErrorDisplay } from "@/core";
import { KeywordInput, useSearchQuery } from "@/search";
import { useLocalizedRealmSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import { RealmCard } from "../components/RealmCard";

/**
 * Full-page realm discovery interface with keyword search.
 * Displays realm results in a responsive grid, with loading and empty states.
 * Search syncs with URL query params for shareability.
 *
 * 具有关键词搜索的整页社区发现界面。
 * 以响应式网格显示社区结果，包含加载和空状态。
 * 搜索与URL查询参数同步以便分享。
 *
 * Layout:
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Realm Search             │
 * ├──────────────────────────┤
 * │ [Search input]           │
 * ├──────────────────────────┤
 * │ [Loading...] or          │
 * │ ┌────────────────────────┤
 * │ │ [Realm Card 1]         │
 * │ ├────────────────────────┤
 * │ │ [Realm Card 2]         │
 * │ ├────────────────────────┤
 * │ │ [Realm Card 3]         │
 * │ └────────────────────────┘
 * │ or "No realms found."    │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Realm Search                       │
 * ├────────────────────────────────────┤
 * │ [Search input]                     │
 * ├────────────────────────────────────┤
 * │ [Card 1]        [Card 2]           │
 * │ [Card 3]        [Card 4]           │
 * │ [Card 5]        [Card 6]           │
 * │ or "No realms found."              │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌──────────────────────────────────────┐
 * │ Realm Search                         │
 * ├──────────────────────────────────────┤
 * │ [Search input]                       │
 * ├──────────────────────────────────────┤
 * │ [Card 1]   [Card 2]   [Card 3]       │
 * │ [Card 4]   [Card 5]   [Card 6]       │
 * │ [Card 7]   [Card 8]   [Card 9]       │
 * │ or "No realms found."                │
 * └──────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop - max-width 5xl container, 3 column grid
 */
export function RealmSearchPage() {
  const { t } = useTranslation(["entity"]);
  const search = useSearchQuery({});
  const keyword = search.query.keyword ?? "";
  const keywordBind = search.bind("keyword");

  const { data, isLoading, isError, error } = useLocalizedRealmSearch({
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
      {isError ? (
        // Search query failed — show error instead of empty results
        // 搜索查询失败 —— 显示错误而非空结果
        <QueryErrorDisplay error={error} />
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : realms.length === 0 ? (
        <p className="py-8 text-center text-text-secondary">
          {hasKeyword
            ? t("entity:realm_none_found")
            : t("entity:realm_empty_yet")}
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
