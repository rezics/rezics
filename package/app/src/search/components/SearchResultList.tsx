import type {
  ContentSearchDocument,
  ContentSearchResult,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { renderContentSearchCard } from "./searchResultCardAdapters";

export type SearchResultListProps = {
  result?: ContentSearchResult;
  isLoading?: boolean;
  preferredLanguage?: string;
  renderItem?: (item: ContentSearchDocument) => React.ReactNode;
};

const DefaultResultItem: React.FC<{
  item: ContentSearchDocument;
  preferredLanguage?: string;
}> = ({ item, preferredLanguage }) => {
  return renderContentSearchCard(item, { preferredLanguage });
};

export const SearchResultList: React.FC<SearchResultListProps> = ({
  result,
  isLoading,
  preferredLanguage,
  renderItem,
}) => {
  const { t } = useTranslation(["common", "search"]);
  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-secondary">{t("common:loading")}</p>
      </div>
    );
  }

  if (!result || result.items.length === 0) {
    return <EmptyState title={t("search:empty_title")} />;
  }

  return (
    <div>
      <p className="mb-2 block text-xs text-text-secondary">
        {t("search:results_summary", {
          count: result.total,
          ms: result.processingTimeMs,
        })}
      </p>
      <div className="space-y-2">
        {result.items.map((item) =>
          renderItem ? (
            <div key={item.id}>{renderItem(item)}</div>
          ) : (
            <DefaultResultItem
              key={item.id}
              item={item}
              preferredLanguage={preferredLanguage}
            />
          ),
        )}
      </div>
    </div>
  );
};
