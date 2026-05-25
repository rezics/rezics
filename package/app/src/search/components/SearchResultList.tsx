import type {
  ContentSearchDocument,
  ContentSearchResult,
} from "@rezics/contract";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  common_loading,
  search_empty_title,
  search_results_summary,
} from "@rezics/i18n/messages";
const m = {
  common_loading,
  search_empty_title,
  search_results_summary,
};

const i18nMessages = {
  common_loading,
  search_empty_title,
  search_results_summary,
};

function resolveTitle(
  titles: string[],
  languages: string[],
  preferredLanguage?: string,
): string {
  if (!titles.length) return "";
  if (preferredLanguage) {
    const idx = languages.indexOf(preferredLanguage);
    if (idx >= 0 && titles[idx]) return titles[idx];
  }
  return titles[0] ?? "";
}

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
  const title = resolveTitle(item.titles, item.languages, preferredLanguage);

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-whisper last:border-b-0">
      {item.coverUrl && (
        <img
          src={item.coverUrl}
          alt={title}
          className="w-24 h-32 object-cover rounded"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title || item.id}</p>
        <p className="text-xs text-text-secondary">{item.type}</p>
        {item.summaries[0] && (
          <p className="text-sm text-text-secondary line-clamp-2 mt-1">
            {item.summaries[0]}
          </p>
        )}
      </div>
    </div>
  );
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
      <div>
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
