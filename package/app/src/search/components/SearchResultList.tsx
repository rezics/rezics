import type {
  ContentSearchDocument,
  ContentSearchResult,
} from "@rezics/contract";
import {
  common_loading,
  search_empty_title,
  search_results_summary,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { renderContentSearchCard } from "./searchResultCardAdapters";

const i18nMessages = {
  common_loading,
  search_empty_title,
  search_results_summary,
};

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
  const m = useMessage(i18nMessages);
  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-secondary">{m.common_loading()}</p>
      </div>
    );
  }

  if (!result || result.items.length === 0) {
    return <EmptyState title={m.search_empty_title()} />;
  }

  return (
    <div>
      <p className="mb-2 block text-xs text-text-secondary">
        {m.search_results_summary({
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
